"""
=============================================================
RAKSHAK — NGO KIT ALLOCATION PIPELINE
=============================================================

Aligned to Rakshak Supabase schema:

  camps         → id, name, lat, lng, radius_km, status
  camp_victims  → camp_id, user_id (headcount = COUNT per camp)
  alerts        → type, risk, lat, lng (triggers allocation review)
  camp_alerts   → disaster_type, severity, status (approval workflow)

Flow:
  1. Camps report headcount (COUNT from camp_victims) → Super Admin
  2. Super Admin computes total kits needed
  3. Divides equally across registered NGOs
  4. NGOs fundraise independently to their share
  5. Kits shipped to Super Admin central inventory
  6. ML model predicts headcount at delivery time
     (uses predictions table risk + camp data)
  7. Smart allocation dispatched to camps
  8. camp_alerts updated with severity when camp goes DANGER
=============================================================
"""

import numpy as np
import pandas as pd
import pickle
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import List, Dict, Optional
import warnings
warnings.filterwarnings("ignore")

MODEL_PATH = "/home/claude/disaster_ml/trained_model.pkl"

PHASE_NAMES  = {0: "SURGE", 1: "PLATEAU", 2: "DEPLETION"}
# Rakshak alert_risk → phase mapping
RISK_TO_PHASE = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}


# ─────────────────────────────────────────────
# CAMP — mirrors Rakshak camps table
# headcount comes from COUNT(camp_victims) per camp
# ─────────────────────────────────────────────

@dataclass
class Camp:
    # ── Rakshak camps table fields ──
    id: str                         # UUID from Supabase
    name: str
    operator_name: str
    operator_phone: str
    lat: float
    lng: float
    radius_km: float
    status: str = "active"          # active / inactive / full

    # ── Derived from camp_victims COUNT ──
    current_headcount: int = 0

    # ── From alerts / predictions tables ──
    alert_type: str = "FLOOD"       # FLOOD/EARTHQUAKE/LANDSLIDE/CYCLONE
    alert_risk: str = "MEDIUM"      # HIGH/MEDIUM/LOW → maps to phase

    # ── ML model features (static per camp) ──
    camp_capacity: int = 500
    distance_from_epicenter_km: float = 10.0
    zone_population_density: float = 30000.0
    camp_quality_score: float = 0.7
    nearby_camps_count: int = 4
    min_kit_ratio: float = 0.8

    # ── Dynamic signals (from camp_victims timestamps) ──
    arrivals_last_1h: int = 0
    arrivals_last_3h: int = 0
    arrivals_last_6h: int = 0
    departures_last_1h: int = 0
    departures_last_3h: int = 0
    arrival_velocity: float = 0.0
    net_flow_last_3h: int = 0
    remaining_pool_estimate: float = 5000.0
    road_accessibility: float = 1.0
    rescue_ops_active: int = 1
    hour_of_day: int = 12
    day_of_disaster: int = 1
    time_since_disaster_hrs: int = 24
    phase_hour: int = 0

    @property
    def phase(self) -> int:
        return RISK_TO_PHASE.get(self.alert_risk, 1)

    @property
    def disaster_type(self) -> str:
        return self.alert_type

    def report_need(self) -> Dict:
        """What camp sends to Super Admin."""
        min_kits = int(np.ceil(self.current_headcount * self.min_kit_ratio))
        return {
            "camp_id":          self.id,
            "camp_name":        self.name,
            "current_headcount":self.current_headcount,
            "min_kits_needed":  min_kits,
            "alert_risk":       self.alert_risk,
            "alert_type":       self.alert_type,
            "phase":            PHASE_NAMES[self.phase],
        }

    def flag_danger(self, reason: str):
        """
        Triggers a camp_alert INSERT in Rakshak with severity=HIGH.
        Locally sets alert_risk to HIGH.
        """
        self.alert_risk = "HIGH"
        self.status = "full"
        print(f"  🚨 [{self.name}] DANGER flagged → camp_alerts INSERT"
              f" (disaster_type={self.alert_type}, severity=HIGH)")
        print(f"     Reason: {reason}")


@dataclass
class NGO:
    ngo_id: str
    ngo_name: str
    cost_per_kit: float = 120.0
    kits_assigned: int = 0
    amount_needed: float = 0.0
    total_raised: float = 0.0
    kits_produced: int = 0
    status: str = "IDLE"
    production_ready_time: Optional[datetime] = None
    donation_log: List[Dict] = field(default_factory=list)

    def receive_assignment(self, kits: int, timestamp: datetime):
        self.kits_assigned  = kits
        self.amount_needed  = kits * self.cost_per_kit
        self.status         = "FUNDRAISING"
        print(f"  📋 [{self.ngo_name}] Assigned {kits} kits "
              f"→ raise ₹{self.amount_needed:,.0f}")

    def receive_donation(self, amount: float, donor: str, timestamp: datetime):
        self.total_raised += amount
        self.donation_log.append({"donor": donor, "amount": amount, "timestamp": timestamp})
        print(f"  💰 [{self.ngo_name}] ₹{amount:,.0f} from {donor} "
              f"| {self.total_raised:,.0f}/{self.amount_needed:,.0f}")
        if self.total_raised >= self.amount_needed and self.status == "FUNDRAISING":
            self.status = "PRODUCING"
            self.production_ready_time = timestamp + timedelta(hours=24)
            print(f"  ✅ [{self.ngo_name}] Threshold met! "
                  f"Ready: {self.production_ready_time.strftime('%Y-%m-%d %H:%M')}")

    def check_and_ship(self, current_time: datetime) -> int:
        if (self.status == "PRODUCING" and self.production_ready_time
                and current_time >= self.production_ready_time):
            self.status = "SHIPPED"
            print(f"  🚚 [{self.ngo_name}] Shipped {self.kits_assigned} kits → inventory")
            return self.kits_assigned
        return 0

    def status_line(self) -> str:
        pct = (self.total_raised / self.amount_needed * 100) if self.amount_needed > 0 else 0
        bar = "█" * int(pct/5) + "░" * (20 - int(pct/5))
        return (f"  {self.ngo_name:25s} | {self.status:11s} | "
                f"₹{self.total_raised:>8,.0f}/₹{self.amount_needed:>8,.0f} "
                f"[{bar}] {pct:.0f}% | {self.kits_assigned} kits")


@dataclass
class Inventory:
    total_kits: int = 0
    log: List[Dict] = field(default_factory=list)

    def receive(self, kits: int, source: str, ts: datetime):
        self.total_kits += kits
        self.log.append({"event":"IN","kits":kits,"source":source,
                         "timestamp":ts,"balance":self.total_kits})
        print(f"  📥 Inventory +{kits} from {source} | Balance: {self.total_kits}")

    def dispatch(self, kits: int, dest: str, ts: datetime):
        self.total_kits -= kits
        self.log.append({"event":"OUT","kits":kits,"destination":dest,
                         "timestamp":ts,"balance":self.total_kits})


# ─────────────────────────────────────────────
# HEADCOUNT PREDICTOR
# Reads predictions table risk to adjust phase
# ─────────────────────────────────────────────

class HeadcountPredictor:
    def __init__(self, model_path: str):
        with open(model_path,"rb") as f:
            saved = pickle.load(f)
        self.model    = saved["model"]
        self.features = saved["features"]

    def predict_at_delivery(self, camp: Camp, delay_hrs: int) -> Dict:
        future_hour = (camp.hour_of_day + delay_hrs) % 24
        future_pool = max(0, camp.remaining_pool_estimate - camp.arrivals_last_1h * delay_hrs)

        row = {
            "camp_capacity":                camp.camp_capacity,
            "distance_from_epicenter_km":   camp.distance_from_epicenter_km,
            "zone_population_density":      camp.zone_population_density,
            "camp_quality_score":           camp.camp_quality_score,
            "nearby_camps_count":           camp.nearby_camps_count,
            "hour_sin":     np.sin(2*np.pi*future_hour/24),
            "hour_cos":     np.cos(2*np.pi*future_hour/24),
            "day_of_disaster":          camp.day_of_disaster + delay_hrs//24,
            "time_since_disaster_hrs":  camp.time_since_disaster_hrs + delay_hrs,
            "phase":        camp.phase,
            "phase_hour":   camp.phase_hour + delay_hrs,
            "phase_progress": min((camp.phase_hour + delay_hrs)/(3*24), 1.0),
            "current_headcount":    camp.current_headcount,
            "arrivals_last_1h":     camp.arrivals_last_1h,
            "arrivals_last_3h":     camp.arrivals_last_3h,
            "arrivals_last_6h":     camp.arrivals_last_6h,
            "departures_last_1h":   camp.departures_last_1h,
            "departures_last_3h":   camp.departures_last_3h,
            "arrival_velocity":     camp.arrival_velocity,
            "velocity_change":      0.0,
            "net_flow_last_3h":     camp.net_flow_last_3h,
            "remaining_pool_estimate": future_pool,
            "road_accessibility":   camp.road_accessibility,
            "rescue_ops_active":    camp.rescue_ops_active,
            "headcount_to_capacity_ratio":  camp.current_headcount/(camp.camp_capacity+1),
            "arrivals_to_departures_ratio": (camp.arrivals_last_3h+1)/(camp.departures_last_3h+1),
            "pool_to_headcount_ratio":      future_pool/(camp.current_headcount+1),
            "log_zone_population_density":  np.log1p(camp.zone_population_density),
            "log_remaining_pool_estimate":  np.log1p(future_pool),
            "log_current_headcount":        np.log1p(camp.current_headcount),
            "dtype_flood":      int(camp.alert_type == "FLOOD"),
            "dtype_earthquake": int(camp.alert_type == "EARTHQUAKE"),
            "dtype_landslide":  int(camp.alert_type == "LANDSLIDE"),
            "dtype_cyclone":    int(camp.alert_type == "CYCLONE"),
        }

        X    = pd.DataFrame([row])[[f for f in self.features if f in row]].fillna(0)
        pred = float(np.clip(self.model.predict(X)[0], 0, camp.camp_capacity))
        return {
            "camp_id":                  camp.id,
            "camp_name":                camp.name,
            "current_headcount":        camp.current_headcount,
            "predicted_at_delivery":    round(pred),
            "alert_risk":               camp.alert_risk,
        }


# ─────────────────────────────────────────────
# ALLOCATION ENGINE
# ─────────────────────────────────────────────

def smart_allocate(camps, predictions, total_kits, buffer_pct=0.15, beta=0.7):
    usable  = int(total_kits * (1 - buffer_pct))
    reserve = total_kits - usable
    pred_map = {p["camp_id"]: p["predicted_at_delivery"] for p in predictions}

    rows = []
    for camp in camps:
        pred       = pred_map.get(camp.id, camp.current_headcount)
        phase_beta = beta if camp.phase < 2 else beta * 0.3
        eff_demand = max(camp.current_headcount + phase_beta*(pred - camp.current_headcount), 1)
        rows.append({
            "camp_id":          camp.id,
            "camp_name":        camp.name,
            "alert_risk":       camp.alert_risk,
            "phase":            PHASE_NAMES[camp.phase],
            "current_headcount":camp.current_headcount,
            "predicted_at_delivery": pred,
            "effective_demand": round(eff_demand, 1),
            "min_floor":        round(camp.current_headcount * camp.min_kit_ratio),
        })

    df = pd.DataFrame(rows)
    df["prop_share"]     = df["effective_demand"] / df["effective_demand"].sum()
    df["kits_raw"]       = df["prop_share"] * usable
    df["kits_allocated"] = df[["kits_raw","min_floor"]].max(axis=1)

    if df["kits_allocated"].sum() > usable:
        df["kits_allocated"] = df["kits_allocated"] / df["kits_allocated"].sum() * usable

    df["kits_allocated"]               = df["kits_allocated"].round().astype(int)
    df["kits_per_person_now"]          = (df["kits_allocated"]/df["current_headcount"]).round(2)
    df["kits_per_person_at_delivery"]  = (df["kits_allocated"]/df["predicted_at_delivery"]).round(2)
    df["reserve_kits"] = reserve
    df["urgency"] = df["kits_per_person_now"].apply(
        lambda x: "🔴 CRITICAL" if x < 0.5 else ("🟡 LOW" if x < 0.8 else "🟢 OK"))
    return df


# ─────────────────────────────────────────────
# SUPER ADMIN ORCHESTRATOR
# ─────────────────────────────────────────────

class SuperAdmin:
    def __init__(self, disaster_id: str, cost_per_kit=120.0,
                 production_delay_hrs=24, buffer_pct=0.15, beta=0.7):
        self.disaster_id          = disaster_id
        self.cost_per_kit         = cost_per_kit
        self.production_delay_hrs = production_delay_hrs
        self.buffer_pct           = buffer_pct
        self.beta                 = beta
        self.camps: Dict[str, Camp] = {}
        self.ngos:  Dict[str, NGO]  = {}
        self.inventory  = Inventory()
        self.predictor  = HeadcountPredictor(MODEL_PATH)
        self.round_num  = 0

    def register_camp(self, camp: Camp):
        self.camps[camp.id] = camp
        print(f"  🏕️  {camp.name} | {camp.current_headcount} people "
              f"| risk={camp.alert_risk} | {camp.alert_type}")

    def register_ngo(self, ngo: NGO):
        self.ngos[ngo.ngo_id] = ngo
        print(f"  🏢 {ngo.ngo_name}")

    def collect_needs(self) -> Dict:
        print(f"\n{'─'*60}")
        print(f"  STEP 1 — CAMPS REPORT TO SUPER ADMIN")
        print(f"{'─'*60}")
        total_kits = 0
        for camp in self.camps.values():
            r = camp.report_need()
            total_kits += r["min_kits_needed"]
            print(f"  {r['camp_name']:30s} | {r['current_headcount']:4d} people "
                  f"| risk={r['alert_risk']:6s} | min={r['min_kits_needed']} kits")

        gap = max(0, total_kits - self.inventory.total_kits)
        print(f"\n  Total needed  : {total_kits} kits")
        print(f"  In inventory  : {self.inventory.total_kits} kits")
        print(f"  Request NGOs  : {gap} kits")
        return {"total_kits_needed": total_kits, "kits_to_request": gap}

    def assign_to_ngos(self, kits: int, timestamp: datetime):
        print(f"\n{'─'*60}")
        print(f"  STEP 2 — DIVIDE EQUALLY ACROSS NGOs")
        print(f"{'─'*60}")
        n      = len(self.ngos)
        base   = kits // n
        remain = kits % n
        print(f"  {kits} kits ÷ {n} NGOs = {base} each (+{remain} to first)\n")
        for i, ngo in enumerate(self.ngos.values()):
            ngo.receive_assignment(base + (remain if i==0 else 0), timestamp)

    def process_donation(self, ngo_id: str, amount: float, donor: str, ts: datetime):
        self.ngos[ngo_id].receive_donation(amount, donor, ts)

    def check_shipments(self, current_time: datetime):
        for ngo in self.ngos.values():
            shipped = ngo.check_and_ship(current_time)
            if shipped > 0:
                self.inventory.receive(shipped, ngo.ngo_name, current_time)

    def run_allocation(self, current_time: datetime):
        self.round_num += 1
        print(f"\n{'─'*60}")
        print(f"  STEP 4 — ALLOCATION ROUND #{self.round_num}")
        print(f"  Inventory: {self.inventory.total_kits} kits")
        print(f"{'─'*60}")

        if self.inventory.total_kits == 0:
            print("  ⚠️  No kits yet."); return None

        predictions = [self.predictor.predict_at_delivery(c, self.production_delay_hrs)
                       for c in self.camps.values()]

        alloc = smart_allocate(list(self.camps.values()), predictions,
                               self.inventory.total_kits, self.buffer_pct, self.beta)

        for _, row in alloc.iterrows():
            self.inventory.dispatch(row["kits_allocated"], row["camp_name"], current_time)

        print(f"\n  📋 DISPATCH ORDERS:")
        print(alloc[["camp_name","alert_risk","current_headcount","predicted_at_delivery",
                      "kits_allocated","kits_per_person_at_delivery","urgency"]].to_string(index=False))
        print(f"\n  Dispatched : {alloc['kits_allocated'].sum()} kits")
        print(f"  Reserved   : {int(alloc['reserve_kits'].iloc[0])} kits (stays in inventory)")
        print(f"  Balance    : {self.inventory.total_kits} kits")

        # camp_alerts: flag HIGH risk camps
        high_risk = [c for c in self.camps.values() if c.alert_risk == "HIGH"]
        if high_risk:
            print(f"\n  ⚠️  camp_alerts UPDATE — {len(high_risk)} HIGH risk camp(s):")
            for c in high_risk:
                print(f"     → {c.name}: severity=HIGH, status=pending review")

        return alloc

    def print_status(self, ts: datetime):
        print(f"\n{'='*60}")
        print(f"  RAKSHAK SUPER ADMIN — {self.disaster_id}")
        print(f"  {ts.strftime('%Y-%m-%d %H:%M')}")
        print(f"{'='*60}")
        print(f"  Camps: {len(self.camps)} | NGOs: {len(self.ngos)} "
              f"| Inventory: {self.inventory.total_kits} kits | Rounds: {self.round_num}")
        print(f"\n  NGO STATUS:")
        for ngo in self.ngos.values(): print(ngo.status_line())
        print(f"\n  CAMP STATUS (from camps + camp_victims tables):")
        for camp in self.camps.values():
            occ = round(camp.current_headcount/camp.camp_capacity*100, 1)
            print(f"  {camp.name:30s} | {camp.current_headcount:4d}/{camp.camp_capacity} "
                  f"({occ}%) | risk={camp.alert_risk:6s} | status={camp.status}")


# ─────────────────────────────────────────────
# DEMO — using real Rakshak Mumbai camps
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import json, uuid as _uuid

    print("\n" + "="*60)
    print("  RAKSHAK — NGO ALLOCATION PIPELINE DEMO")
    print("="*60)

    t0 = datetime(2024, 7, 15, 9, 0)

    # Load real Rakshak camp IDs from seed CSV
    camps_seed = pd.read_csv("/home/claude/disaster_ml/rakshak_camps_seed.csv")

    # Simulate live headcounts (in production: COUNT(camp_victims) per camp_id)
    headcounts  = [420, 310, 185, 95, 270, 140, 230, 380]
    alert_risks = ["HIGH","HIGH","MEDIUM","LOW","MEDIUM","LOW","MEDIUM","HIGH"]

    camps = []
    for i, (_, row) in enumerate(camps_seed.iterrows()):
        camps.append(Camp(
            id=row["id"], name=row["name"],
            operator_name=row["operator_name"],
            operator_phone=row["operator_phone"],
            lat=row["lat"], lng=row["lng"],
            radius_km=row["radius_km"], status=row["status"],
            current_headcount=headcounts[i],
            alert_type="FLOOD", alert_risk=alert_risks[i],
            camp_capacity=[600,500,350,200,400,300,450,550][i],
            distance_from_epicenter_km=[2.1,5.3,12.4,7.8,3.5,22.1,9.2,11.7][i],
            zone_population_density=[80000,45000,28000,22000,38000,18000,31000,52000][i],
            camp_quality_score=[0.70,0.65,0.75,0.80,0.70,0.60,0.72,0.55][i],
            nearby_camps_count=4,
            arrivals_last_1h=[12,8,5,3,7,4,6,15][i],
            arrivals_last_3h=[30,20,12,8,18,10,16,40][i],
            arrivals_last_6h=[55,38,22,14,34,18,30,75][i],
            departures_last_1h=[2,2,1,1,2,1,2,3][i],
            departures_last_3h=[5,5,3,2,5,3,5,8][i],
            arrival_velocity=[0.4,0.3,0.2,0.1,0.25,0.15,0.2,0.5][i],
            net_flow_last_3h=[25,15,9,6,13,7,11,32][i],
            remaining_pool_estimate=[8000,5000,3000,2000,4000,2000,3500,7000][i],
            hour_of_day=9, day_of_disaster=1,
            time_since_disaster_hrs=9, phase_hour=9,
        ))

    ngos = [
        NGO("NSS_01", "NSS Mumbai Chapter",    cost_per_kit=120.0),
        NGO("RED_01", "Red Cross Maharashtra", cost_per_kit=120.0),
        NGO("HLP_01", "HelpNow Foundation",    cost_per_kit=120.0),
    ]

    admin = SuperAdmin("FLOOD_2024_MUMBAI", cost_per_kit=120.0,
                       production_delay_hrs=24, buffer_pct=0.15, beta=0.7)

    print("\n📋 REGISTERING...")
    for c in camps: admin.register_camp(c)
    for n in ngos:  admin.register_ngo(n)

    # Step 1 & 2
    needs = admin.collect_needs()
    admin.assign_to_ngos(needs["kits_to_request"], t0)

    # Step 3: donations
    print(f"\n{'─'*60}")
    print(f"  STEP 3 — NGOs FUNDRAISING")
    print(f"{'─'*60}")
    donations = [
        ("NSS_01", 40000, "Tata Trust",       0.5),
        ("RED_01", 50000, "Reliance Found.",   0.5),
        ("HLP_01", 30000, "Public",            0.5),
        ("NSS_01", 30000, "HDFC CSR",          1.5),
        ("RED_01", 30000, "Govt Match",        2.0),
        ("HLP_01", 30000, "Anonymous",         2.5),
        ("NSS_01", 20000, "Local Donor",       3.0),
        ("RED_01", 20000, "Corp Donation",     3.5),
        ("HLP_01", 20000, "Community Fund",    4.0),
    ]
    for ngo_id, amt, donor, hrs in donations:
        admin.process_donation(ngo_id, amt, donor, t0 + timedelta(hours=hrs))

    admin.print_status(t0 + timedelta(hours=5))

    # 24h later — ship + allocate
    print(f"\n{'─'*60}")
    print(f"  ⏳ 24H LATER — NGOs SHIP TO SUPER ADMIN INVENTORY")
    print(f"{'─'*60}")
    t_delivery = t0 + timedelta(hours=28)
    admin.check_shipments(t_delivery)
    admin.run_allocation(t_delivery)
    admin.print_status(t_delivery)

    print(f"\n{'─'*60}")
    print(f"  INVENTORY LEDGER")
    print(f"{'─'*60}")
    print(pd.DataFrame(admin.inventory.log).to_string(index=False))
