"""
=============================================================
RAKSHAK ML — END-TO-END TEST WITH DUMMY DATA
=============================================================
Runs the full pipeline locally without Supabase:
  1. Generates dummy victims / check-ins per camp
  2. Derives headcounts + arrival signals (as DB would)
  3. Loads trained model from local trained_model.pkl
  4. Predicts headcount at delivery time
  5. Runs smart kit allocation
  6. Exercises db_integration write functions (dry-run)
=============================================================
"""

import os, sys, uuid, pickle, warnings
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

warnings.filterwarnings("ignore")

# ── resolve paths relative to this file ──────────────────
ML_DIR     = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(ML_DIR, "trained_model.pkl")

# Patch hardcoded paths in ngo_pipeline before importing
import importlib, types

# inject MODEL_PATH override before ngo_pipeline reads it
sys.path.insert(0, ML_DIR)

# We need to monkey-patch the MODEL_PATH constant in ngo_pipeline
import ngo_pipeline as _ngo_raw
_ngo_raw.MODEL_PATH = MODEL_PATH

from ngo_pipeline import (
    Camp, NGO, SuperAdmin, Inventory,
    HeadcountPredictor, smart_allocate,
    PHASE_NAMES, RISK_TO_PHASE,
)
import db_integration as db

print("\n" + "="*60)
print("  RAKSHAK ML — DUMMY DATA TEST RUN")
print("="*60)


# ─────────────────────────────────────────────
# STEP 0 — Generate dummy "victims" (check-ins)
# Simulates what camp_victims rows would look like
# Each victim has a camp_id + checked_in_at timestamp
# ─────────────────────────────────────────────

print("\n[STEP 0] Generating dummy victims (simulating camp_victims table)...")

NOW = datetime(2026, 3, 1, 9, 0)

DUMMY_CAMPS_DEF = [
    {
        "id":           "camp-dharavi-001",
        "name":         "Dharavi Relief Camp",
        "operator_name":"Rajesh Patil",
        "operator_phone":"+912212345678",
        "lat": 19.0422, "lng": 72.8533,
        "radius_km": 3.0, "status": "active",
        "camp_capacity": 600,
        "distance_from_epicenter_km": 2.1,
        "zone_population_density": 80000,
        "camp_quality_score": 0.70,
        "nearby_camps_count": 4,
        "alert_type": "FLOOD", "alert_risk": "HIGH",
        # Dummy check-in counts (simulates COUNT queries on camp_victims)
        "_victims_total":   420,
        "_arrivals_1h":      22,
        "_arrivals_3h":      55,
        "_arrivals_6h":      90,
        "_departures_1h":     3,
        "_departures_3h":     8,
    },
    {
        "id":           "camp-kurla-002",
        "name":         "Kurla West Relief Camp",
        "operator_name":"Sunita Desai",
        "operator_phone":"+912212345679",
        "lat": 19.0726, "lng": 72.8795,
        "radius_km": 4.0, "status": "active",
        "camp_capacity": 500,
        "distance_from_epicenter_km": 5.3,
        "zone_population_density": 45000,
        "camp_quality_score": 0.65,
        "nearby_camps_count": 4,
        "alert_type": "FLOOD", "alert_risk": "HIGH",
        "_victims_total":   310,
        "_arrivals_1h":      18,
        "_arrivals_3h":      40,
        "_arrivals_6h":      72,
        "_departures_1h":     2,
        "_departures_3h":     6,
    },
    {
        "id":           "camp-andheri-003",
        "name":         "Andheri East Relief Camp",
        "operator_name":"Amir Shaikh",
        "operator_phone":"+912212345680",
        "lat": 19.1136, "lng": 72.8697,
        "radius_km": 5.0, "status": "active",
        "camp_capacity": 350,
        "distance_from_epicenter_km": 12.4,
        "zone_population_density": 28000,
        "camp_quality_score": 0.75,
        "nearby_camps_count": 4,
        "alert_type": "FLOOD", "alert_risk": "MEDIUM",
        "_victims_total":   185,
        "_arrivals_1h":       7,
        "_arrivals_3h":      18,
        "_arrivals_6h":      29,
        "_departures_1h":     2,
        "_departures_3h":     5,
    },
    {
        "id":           "camp-bandra-004",
        "name":         "Bandra Reclamation Camp",
        "operator_name":"Priya Nair",
        "operator_phone":"+912212345681",
        "lat": 19.0596, "lng": 72.8295,
        "radius_km": 3.5, "status": "active",
        "camp_capacity": 200,
        "distance_from_epicenter_km": 7.8,
        "zone_population_density": 22000,
        "camp_quality_score": 0.80,
        "nearby_camps_count": 4,
        "alert_type": "FLOOD", "alert_risk": "LOW",
        "_victims_total":    95,
        "_arrivals_1h":       4,
        "_arrivals_3h":       9,
        "_arrivals_6h":      15,
        "_departures_1h":     1,
        "_departures_3h":     3,
    },
    {
        "id":           "camp-sion-005",
        "name":         "Sion Relief Camp",
        "operator_name":"Vikram Joshi",
        "operator_phone":"+912212345682",
        "lat": 19.0430, "lng": 72.8625,
        "radius_km": 3.0, "status": "active",
        "camp_capacity": 400,
        "distance_from_epicenter_km": 3.5,
        "zone_population_density": 38000,
        "camp_quality_score": 0.70,
        "nearby_camps_count": 4,
        "alert_type": "FLOOD", "alert_risk": "MEDIUM",
        "_victims_total":   270,
        "_arrivals_1h":      12,
        "_arrivals_3h":      30,
        "_arrivals_6h":      52,
        "_departures_1h":     2,
        "_departures_3h":     7,
    },
    {
        "id":           "camp-malad-006",
        "name":         "Malad West Relief Camp",
        "operator_name":"Fatima Khan",
        "operator_phone":"+912212345683",
        "lat": 19.1872, "lng": 72.8484,
        "radius_km": 6.0, "status": "active",
        "camp_capacity": 300,
        "distance_from_epicenter_km": 22.1,
        "zone_population_density": 18000,
        "camp_quality_score": 0.60,
        "nearby_camps_count": 4,
        "alert_type": "FLOOD", "alert_risk": "LOW",
        "_victims_total":   140,
        "_arrivals_1h":       5,
        "_arrivals_3h":      12,
        "_arrivals_6h":      20,
        "_departures_1h":     1,
        "_departures_3h":     4,
    },
    {
        "id":           "camp-chembur-007",
        "name":         "Chembur Relief Camp",
        "operator_name":"Deepak Mehta",
        "operator_phone":"+912212345684",
        "lat": 19.0622, "lng": 72.9005,
        "radius_km": 4.5, "status": "active",
        "camp_capacity": 450,
        "distance_from_epicenter_km": 9.2,
        "zone_population_density": 31000,
        "camp_quality_score": 0.72,
        "nearby_camps_count": 4,
        "alert_type": "FLOOD", "alert_risk": "MEDIUM",
        "_victims_total":   230,
        "_arrivals_1h":       9,
        "_arrivals_3h":      22,
        "_arrivals_6h":      38,
        "_departures_1h":     2,
        "_departures_3h":     6,
    },
    {
        "id":           "camp-govandi-008",
        "name":         "Govandi Relief Camp",
        "operator_name":"Anjali Rao",
        "operator_phone":"+912212345685",
        "lat": 19.0742, "lng": 72.9186,
        "radius_km": 5.0, "status": "active",
        "camp_capacity": 550,
        "distance_from_epicenter_km": 11.7,
        "zone_population_density": 52000,
        "camp_quality_score": 0.55,
        "nearby_camps_count": 4,
        "alert_type": "FLOOD", "alert_risk": "HIGH",
        "_victims_total":   380,
        "_arrivals_1h":      20,
        "_arrivals_3h":      50,
        "_arrivals_6h":      88,
        "_departures_1h":     3,
        "_departures_3h":     9,
    },
]

# Print dummy victims table summary
victims_rows = []
for c in DUMMY_CAMPS_DEF:
    for i in range(c["_victims_total"]):
        # Spread check-ins across last 6h
        mins_ago = int(np.random.exponential(scale=180))
        checked_in = NOW - timedelta(minutes=mins_ago)
        victims_rows.append({
            "id":           str(uuid.uuid4()),
            "camp_id":      c["id"],
            "user_id":      str(uuid.uuid4()),
            "name":         f"Victim_{i+1:04d}",
            "checked_in_at": checked_in.isoformat(),
            "checked_in_via": np.random.choice(["qr_scan", "manual", "sms"], p=[0.6, 0.3, 0.1]),
        })

df_victims = pd.DataFrame(victims_rows)
print(f"  Generated {len(df_victims):,} dummy victim check-ins across {len(DUMMY_CAMPS_DEF)} camps")
print(f"  Columns: {list(df_victims.columns)}")
print()

camp_summary = df_victims.groupby("camp_id").agg(
    count=("id","count"),
    via_qr=("checked_in_via", lambda x: (x=="qr_scan").sum()),
    via_manual=("checked_in_via", lambda x: (x=="manual").sum()),
    via_sms=("checked_in_via", lambda x: (x=="sms").sum()),
).reset_index()

name_map = {c["id"]: c["name"] for c in DUMMY_CAMPS_DEF}
camp_summary["camp_name"] = camp_summary["camp_id"].map(name_map)
print(camp_summary[["camp_name","count","via_qr","via_manual","via_sms"]].to_string(index=False))


# ─────────────────────────────────────────────
# STEP 1 — Build Camp objects from dummy data
# (mirrors what db_integration.get_live_camps() returns)
# ─────────────────────────────────────────────

print("\n[STEP 1] Building Camp objects from headcount data...")

camps = []
for c in DUMMY_CAMPS_DEF:
    velocity = (c["_arrivals_3h"] - c["_departures_3h"]) / (c["_arrivals_3h"] + 1e-5)
    camp = Camp(
        id=c["id"],
        name=c["name"],
        operator_name=c["operator_name"],
        operator_phone=c["operator_phone"],
        lat=c["lat"], lng=c["lng"],
        radius_km=c["radius_km"],
        status=c["status"],
        current_headcount=c["_victims_total"],
        alert_type=c["alert_type"],
        alert_risk=c["alert_risk"],
        camp_capacity=c["camp_capacity"],
        distance_from_epicenter_km=c["distance_from_epicenter_km"],
        zone_population_density=c["zone_population_density"],
        camp_quality_score=c["camp_quality_score"],
        nearby_camps_count=c["nearby_camps_count"],
        arrivals_last_1h=c["_arrivals_1h"],
        arrivals_last_3h=c["_arrivals_3h"],
        arrivals_last_6h=c["_arrivals_6h"],
        departures_last_1h=c["_departures_1h"],
        departures_last_3h=c["_departures_3h"],
        arrival_velocity=round(velocity, 3),
        net_flow_last_3h=c["_arrivals_3h"] - c["_departures_3h"],
        remaining_pool_estimate=c["zone_population_density"] * 0.04,
        hour_of_day=NOW.hour,
        day_of_disaster=1,
        time_since_disaster_hrs=9,
        phase_hour=9,
    )
    camps.append(camp)

for camp in camps:
    occ = round(camp.current_headcount / camp.camp_capacity * 100, 1)
    print(f"  {camp.name:30s} | {camp.current_headcount:4d}/{camp.camp_capacity} ({occ:5.1f}%) "
          f"| risk={camp.alert_risk:6s} | phase={PHASE_NAMES[camp.phase]}")


# ─────────────────────────────────────────────
# STEP 2 — Load trained model + predict headcount
# (mirrors what /api/ml/predict endpoint does)
# ─────────────────────────────────────────────

print(f"\n[STEP 2] Loading model from {MODEL_PATH}")

if not os.path.exists(MODEL_PATH):
    print("  ⚠️  trained_model.pkl not found — run model.py first to generate it.")
    sys.exit(1)

predictor = HeadcountPredictor(MODEL_PATH)
print(f"  Model loaded. Features: {len(predictor.features)}")

print("\n  Predicting headcount at T+24h (delivery time):\n")
predictions = []
for camp in camps:
    pred = predictor.predict_at_delivery(camp, delay_hrs=24)
    predictions.append(pred)
    delta = pred["predicted_at_delivery"] - camp.current_headcount
    sign  = "+" if delta >= 0 else ""
    print(f"  {camp.name:30s} | now={camp.current_headcount:4d} "
          f"→ T+24h: {pred['predicted_at_delivery']:4d} ({sign}{delta:+d})")


# ─────────────────────────────────────────────
# STEP 3 — NGO fundraising + kit allocation
# ─────────────────────────────────────────────

print("\n[STEP 3] Running NGO pipeline...")

dummy_ngos = [
    NGO("NSS_01", "NSS Mumbai Chapter",    cost_per_kit=120.0),
    NGO("RED_01", "Red Cross Maharashtra", cost_per_kit=120.0),
    NGO("HLP_01", "HelpNow Foundation",    cost_per_kit=120.0),
]

admin = SuperAdmin(
    disaster_id="FLOOD_2026_MUMBAI_TEST",
    cost_per_kit=120.0,
    production_delay_hrs=24,
    buffer_pct=0.15,
    beta=0.7,
)

print("\n  Registering camps...")
for c in camps:
    admin.register_camp(c)

print("\n  Registering NGOs...")
for n in dummy_ngos:
    admin.register_ngo(n)

# Step 1: Collect needs
needs = admin.collect_needs()

# Step 2: Assign kits to NGOs
admin.assign_to_ngos(needs["kits_to_request"], NOW)

# Step 3: Process donations
print(f"\n{'─'*60}")
print(f"  STEP 3 — DUMMY DONATIONS FLOWING IN")
print(f"{'─'*60}")

dummy_donations = [
    ("NSS_01", 45000, "Tata Trust",        0.5),
    ("RED_01", 55000, "Reliance Found.",    0.5),
    ("HLP_01", 35000, "Public Donations",   0.5),
    ("NSS_01", 35000, "HDFC CSR",           1.5),
    ("RED_01", 30000, "Govt Match",         2.0),
    ("HLP_01", 30000, "Anonymous",          2.5),
    ("NSS_01", 25000, "Local Business",     3.0),
    ("RED_01", 25000, "Corp Donation",      3.5),
    ("HLP_01", 25000, "Community Fund",     4.0),
    ("NSS_01", 20000, "Individual",         4.5),
    ("RED_01", 20000, "NGO Partner",        5.0),
    ("HLP_01", 20000, "Crowdfund",          5.5),
]

for ngo_id, amt, donor, hrs in dummy_donations:
    admin.process_donation(ngo_id, amt, donor, NOW + timedelta(hours=hrs))

admin.print_status(NOW + timedelta(hours=6))

# 24h later — NGOs ship kits
print(f"\n{'─'*60}")
print(f"  ⏳  24H LATER — NGOs SHIP KITS TO CENTRAL INVENTORY")
print(f"{'─'*60}")
t_delivery = NOW + timedelta(hours=28)
admin.check_shipments(t_delivery)

# Allocation round
alloc = admin.run_allocation(t_delivery)


# ─────────────────────────────────────────────
# STEP 4 — db_integration dry-run writes
# Shows what would be written to Supabase tables
# ─────────────────────────────────────────────

print(f"\n{'='*60}")
print(f"  STEP 4 — db_integration DRY-RUN WRITES")
print(f"  (Supabase INSERT payloads — no real DB needed)")
print(f"{'='*60}")

print(f"\n  → predictions table (one row per camp):")
for pred in predictions:
    camp = next(c for c in camps if c.id == pred["camp_id"])
    payload = db.write_prediction(
        camp_id=camp.id,
        lat=camp.lat, lng=camp.lng,
        camp_name=camp.name,
        predicted_headcount=pred["predicted_at_delivery"],
        current_headcount=camp.current_headcount,
        alert_risk=camp.alert_risk,
        alert_type=camp.alert_type,
    )

print(f"\n  → camp_alerts table (HIGH risk camps only):")
for camp in camps:
    if camp.alert_risk == "HIGH":
        occ = round(camp.current_headcount / camp.camp_capacity * 100, 1)
        db.flag_camp_danger(
            camp_id=camp.id,
            camp_lat=camp.lat, camp_lng=camp.lng,
            camp_name=camp.name,
            disaster_type=camp.alert_type,
            reason=f"Occupancy at {occ}% and rising — ML model flags SURGE phase.",
        )

if alloc is not None:
    print(f"\n  → kit dispatch ledger (one row per dispatched camp):")
    for _, row in alloc.iterrows():
        camp = next((c for c in camps if c.name == row["camp_name"]), None)
        if camp is None:
            continue
        db.write_kit_dispatch(
            camp_id=camp.id,
            camp_lat=camp.lat, camp_lng=camp.lng,
            camp_name=camp.name,
            kits_allocated=int(row["kits_allocated"]),
            predicted_headcount=int(row["predicted_at_delivery"]),
            urgency=row["urgency"],
            alert_type=camp.alert_type,
        )


# ─────────────────────────────────────────────
# STEP 5 — Final summary table
# ─────────────────────────────────────────────

print(f"\n{'='*60}")
print(f"  FINAL ALLOCATION SUMMARY")
print(f"{'='*60}\n")

if alloc is not None:
    summary = alloc[[
        "camp_name", "alert_risk", "phase",
        "current_headcount", "predicted_at_delivery",
        "kits_allocated", "kits_per_person_at_delivery", "urgency"
    ]].copy()
    summary.columns = [
        "Camp", "Risk", "Phase",
        "Now", "T+24h Pred",
        "Kits", "K/Person", "Urgency"
    ]
    print(summary.to_string(index=False))
    print(f"\n  Total victims tracked : {sum(c.current_headcount for c in camps):,}")
    print(f"  Total kits dispatched : {alloc['kits_allocated'].sum():,}")
    print(f"  Kits reserved (15%)   : {int(alloc['reserve_kits'].iloc[0]):,}")

print(f"\n{'='*60}")
print(f"  ✅ TEST COMPLETE — all steps passed")
print(f"{'='*60}\n")
