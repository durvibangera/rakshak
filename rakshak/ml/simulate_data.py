"""
=============================================================
RAKSHAK — SIMULATED TRAINING DATA
=============================================================
Aligned to Rakshak Supabase schema:

  camps table:
    id (UUID), name, operator_name, operator_phone,
    lat, lng, radius_km, status

  camp_victims table:
    camp_id → users (headcount derived from COUNT)

  alerts table:
    type (FLOOD/EARTHQUAKE/LANDSLIDE/CYCLONE), risk (HIGH/MEDIUM/LOW),
    lat, lng, created_at

  predictions table:
    lat, lng, overall_risk, flood_risk, earthquake_risk,
    landslide_risk, cyclone_risk

Each simulated row = one hourly snapshot per camp.
Target = headcount 6h from now (what the ML model predicts).
=============================================================
"""

import numpy as np
import pandas as pd
from scipy.stats import poisson
import random
import uuid

np.random.seed(42)
random.seed(42)

DISASTER_TYPES = ["FLOOD", "EARTHQUAKE", "LANDSLIDE", "CYCLONE"]

PHASE_DURATIONS = {
    "FLOOD":      {"surge": 2, "plateau": 3, "depletion": 4},
    "EARTHQUAKE": {"surge": 3, "plateau": 4, "depletion": 5},
    "LANDSLIDE":  {"surge": 1, "plateau": 2, "depletion": 3},
    "CYCLONE":    {"surge": 2, "plateau": 3, "depletion": 4},
}

TOD_CURVE = {
    0:0.10, 1:0.05, 2:0.03, 3:0.03, 4:0.04, 5:0.08,
    6:0.15, 7:0.30, 8:0.55, 9:0.70, 10:0.80, 11:0.90,
    12:1.00, 13:1.00, 14:0.95, 15:0.90, 16:0.85, 17:0.80,
    18:0.65, 19:0.50, 20:0.35, 21:0.25, 22:0.18, 23:0.12,
}

RAKSHAK_CAMPS = [
    {"id": str(uuid.uuid4()), "name": "Dharavi Relief Camp",
     "operator_name": "Rajesh Patil", "operator_phone": "+912212345678",
     "operator_email": "dharavi@rakshak.in",
     "lat": 19.0422, "lng": 72.8533, "radius_km": 3.0, "status": "active",
     "camp_capacity": 600, "distance_from_epicenter_km": 2.1,
     "zone_population_density": 80000, "camp_quality_score": 0.70,
     "nearby_camps_count": 4, "disaster_type": "FLOOD"},

    {"id": str(uuid.uuid4()), "name": "Kurla West Relief Camp",
     "operator_name": "Sunita Desai", "operator_phone": "+912212345679",
     "operator_email": "kurla@rakshak.in",
     "lat": 19.0726, "lng": 72.8795, "radius_km": 4.0, "status": "active",
     "camp_capacity": 500, "distance_from_epicenter_km": 5.3,
     "zone_population_density": 45000, "camp_quality_score": 0.65,
     "nearby_camps_count": 4, "disaster_type": "FLOOD"},

    {"id": str(uuid.uuid4()), "name": "Andheri East Relief Camp",
     "operator_name": "Amir Shaikh", "operator_phone": "+912212345680",
     "operator_email": "andheri@rakshak.in",
     "lat": 19.1136, "lng": 72.8697, "radius_km": 5.0, "status": "active",
     "camp_capacity": 350, "distance_from_epicenter_km": 12.4,
     "zone_population_density": 28000, "camp_quality_score": 0.75,
     "nearby_camps_count": 4, "disaster_type": "FLOOD"},

    {"id": str(uuid.uuid4()), "name": "Bandra Reclamation Camp",
     "operator_name": "Priya Nair", "operator_phone": "+912212345681",
     "operator_email": "bandra@rakshak.in",
     "lat": 19.0596, "lng": 72.8295, "radius_km": 3.5, "status": "active",
     "camp_capacity": 200, "distance_from_epicenter_km": 7.8,
     "zone_population_density": 22000, "camp_quality_score": 0.80,
     "nearby_camps_count": 4, "disaster_type": "FLOOD"},

    {"id": str(uuid.uuid4()), "name": "Sion Relief Camp",
     "operator_name": "Vikram Joshi", "operator_phone": "+912212345682",
     "operator_email": "sion@rakshak.in",
     "lat": 19.0430, "lng": 72.8625, "radius_km": 3.0, "status": "active",
     "camp_capacity": 400, "distance_from_epicenter_km": 3.5,
     "zone_population_density": 38000, "camp_quality_score": 0.70,
     "nearby_camps_count": 4, "disaster_type": "FLOOD"},

    {"id": str(uuid.uuid4()), "name": "Malad West Relief Camp",
     "operator_name": "Fatima Khan", "operator_phone": "+912212345683",
     "operator_email": "malad@rakshak.in",
     "lat": 19.1872, "lng": 72.8484, "radius_km": 6.0, "status": "active",
     "camp_capacity": 300, "distance_from_epicenter_km": 22.1,
     "zone_population_density": 18000, "camp_quality_score": 0.60,
     "nearby_camps_count": 4, "disaster_type": "FLOOD"},

    {"id": str(uuid.uuid4()), "name": "Chembur Relief Camp",
     "operator_name": "Deepak Mehta", "operator_phone": "+912212345684",
     "operator_email": "chembur@rakshak.in",
     "lat": 19.0622, "lng": 72.9005, "radius_km": 4.5, "status": "active",
     "camp_capacity": 450, "distance_from_epicenter_km": 9.2,
     "zone_population_density": 31000, "camp_quality_score": 0.72,
     "nearby_camps_count": 4, "disaster_type": "FLOOD"},

    {"id": str(uuid.uuid4()), "name": "Govandi Relief Camp",
     "operator_name": "Anjali Rao", "operator_phone": "+912212345685",
     "operator_email": "govandi@rakshak.in",
     "lat": 19.0742, "lng": 72.9186, "radius_km": 5.0, "status": "active",
     "camp_capacity": 550, "distance_from_epicenter_km": 11.7,
     "zone_population_density": 52000, "camp_quality_score": 0.55,
     "nearby_camps_count": 4, "disaster_type": "FLOOD"},
]


def risk_level(phase, velocity):
    if phase == 0 and velocity > 0.3: return "HIGH"
    elif phase == 1:                  return "MEDIUM"
    else:                             return "LOW"


def base_arrival_rate(camp, phase, day_in_phase, total_days_phase, remaining_pool):
    gravity = (camp["camp_quality_score"] * np.sqrt(camp["zone_population_density"])) / \
              (camp["distance_from_epicenter_km"]**0.8 * camp["nearby_camps_count"]**0.5)
    gravity   = np.clip(gravity, 0.01, 50)
    pool_pull = gravity / (gravity + 10)
    if phase == 0:
        return pool_pull * remaining_pool * 0.04 * (0.3 + 0.7 * day_in_phase / total_days_phase)
    elif phase == 1:
        return pool_pull * remaining_pool * 0.015
    else:
        return pool_pull * remaining_pool * 0.01 * np.exp(-0.15 * day_in_phase)


def departure_rate(headcount, phase, day_in_phase):
    if phase == 0:   return headcount * 0.005
    elif phase == 1: return headcount * (0.02 + 0.005 * day_in_phase)
    else:            return headcount * (0.06 + 0.01 * day_in_phase)


def simulate_camp(camp, n_disasters=5):
    rows = []
    dtype     = camp["disaster_type"]
    durations = PHASE_DURATIONS[dtype]

    for disaster_idx in range(n_disasters):
        total_hours    = (durations["surge"] + durations["plateau"] + durations["depletion"]) * 24
        headcount      = np.random.randint(10, 50)
        remaining_pool = camp["zone_population_density"] * np.random.uniform(0.01, 0.05)

        arrivals_history   = []
        departures_history = []
        surge_end    = durations["surge"] * 24
        plateau_end  = surge_end + durations["plateau"] * 24

        for h in range(total_hours):
            if h < surge_end:
                phase = 0; day_in_phase = h // 24; tdp = durations["surge"]
            elif h < plateau_end:
                phase = 1; day_in_phase = (h - surge_end) // 24; tdp = durations["plateau"]
            else:
                phase = 2; day_in_phase = (h - plateau_end) // 24; tdp = durations["depletion"]

            hour_of_day = h % 24
            road_ok     = np.random.uniform(0.0, 0.4) if np.random.random() < 0.05 else 1.0
            rescue      = int(6 <= hour_of_day <= 20 and phase <= 1)

            lam_arr  = base_arrival_rate(camp, phase, day_in_phase, tdp, remaining_pool) \
                       * TOD_CURVE[hour_of_day] * road_ok * (1.3 if rescue else 1.0)
            arrivals   = poisson.rvs(max(lam_arr, 0))
            departures = min(poisson.rvs(max(departure_rate(headcount, phase, day_in_phase), 0)), headcount)

            headcount      = min(max(0, headcount + arrivals - departures), camp["camp_capacity"])
            remaining_pool = max(0, remaining_pool - arrivals)

            arrivals_history.append(arrivals)
            departures_history.append(departures)

            arr_1h = arrivals_history[-1]
            arr_3h = sum(arrivals_history[-3:])
            arr_6h = sum(arrivals_history[-6:])
            dep_1h = departures_history[-1]
            dep_3h = sum(departures_history[-3:])

            velocity = ((arr_3h - sum(arrivals_history[-6:-3])) /
                        (sum(arrivals_history[-6:-3]) + 1e-5)) if len(arrivals_history) >= 4 else 0.0

            risk = risk_level(phase, velocity)

            rows.append({
                # ── Rakshak camps fields ──
                "camp_id":          camp["id"],
                "camp_name":        camp["name"],
                "camp_lat":         camp["lat"],
                "camp_lng":         camp["lng"],
                "camp_radius_km":   camp["radius_km"],
                "camp_status":      camp["status"],
                "operator_phone":   camp["operator_phone"],

                # ── Rakshak alerts fields ──
                "alert_type":       dtype,
                "alert_risk":       risk,
                "disaster_idx":     disaster_idx,

                # ── Rakshak predictions fields ──
                "overall_risk":         risk,
                "flood_risk":           risk if dtype == "FLOOD"      else "LOW",
                "earthquake_risk":      risk if dtype == "EARTHQUAKE" else "LOW",
                "landslide_risk":       risk if dtype == "LANDSLIDE"  else "LOW",
                "cyclone_risk":         risk if dtype == "CYCLONE"    else "LOW",

                # ── Headcount (derived from COUNT(camp_victims)) ──
                "current_headcount": headcount,
                "camp_capacity":     camp["camp_capacity"],
                "occupancy_pct":     round(headcount / camp["camp_capacity"] * 100, 1),

                # ── Temporal ──
                "hour_of_day":              hour_of_day,
                "hour_abs":                 h,
                "day_of_disaster":          h // 24,
                "time_since_disaster_hrs":  h,
                "phase":                    phase,
                "phase_hour":               h - [0, surge_end, plateau_end][phase],

                # ── Arrival signals (from camp_victims insert timestamps) ──
                "arrivals_last_1h":  arr_1h,
                "arrivals_last_3h":  arr_3h,
                "arrivals_last_6h":  arr_6h,
                "departures_last_1h": dep_1h,
                "departures_last_3h": dep_3h,
                "arrival_velocity":  velocity,
                "net_flow_last_3h":  arr_3h - dep_3h,

                # ── Context ──
                "remaining_pool_estimate":      remaining_pool,
                "road_accessibility":           road_ok,
                "rescue_ops_active":            rescue,
                "distance_from_epicenter_km":   camp["distance_from_epicenter_km"],
                "zone_population_density":      camp["zone_population_density"],
                "camp_quality_score":           camp["camp_quality_score"],
                "nearby_camps_count":           camp["nearby_camps_count"],

                # ── One-hot disaster type ──
                "dtype_flood":      int(dtype == "FLOOD"),
                "dtype_earthquake": int(dtype == "EARTHQUAKE"),
                "dtype_landslide":  int(dtype == "LANDSLIDE"),
                "dtype_cyclone":    int(dtype == "CYCLONE"),

                "headcount_next_6h": np.nan,
            })

        event_rows = rows[-(total_hours):]
        for i, row in enumerate(event_rows):
            row["headcount_next_6h"] = event_rows[i+6]["current_headcount"] \
                                       if i+6 < len(event_rows) else np.nan

    return rows


if __name__ == "__main__":
    print("Generating Rakshak-aligned simulated data...")

    all_rows = []
    for camp in RAKSHAK_CAMPS:
        all_rows.extend(simulate_camp(camp, n_disasters=5))

    df = pd.DataFrame(all_rows).dropna(subset=["headcount_next_6h"])

    print(f"\n✅ Dataset : {df.shape[0]:,} rows × {df.shape[1]} columns")
    print(f"   Camps   : {df['camp_id'].nunique()}")
    print(f"   Risk dist:\n{df['alert_risk'].value_counts().to_string()}")
    print(f"   Phase dist:\n{df['phase'].value_counts().rename({0:'SURGE',1:'PLATEAU',2:'DEPLETION'}).to_string()}")

    df.to_csv("/home/claude/disaster_ml/simulated_data.csv", index=False)

    # Rakshak camps seed CSV (for Supabase INSERT)
    camps_seed = pd.DataFrame([{
        "id": c["id"], "name": c["name"],
        "operator_name": c["operator_name"], "operator_phone": c["operator_phone"],
        "operator_email": c["operator_email"],
        "lat": c["lat"], "lng": c["lng"],
        "radius_km": c["radius_km"], "status": c["status"],
    } for c in RAKSHAK_CAMPS])
    camps_seed.to_csv("/home/claude/disaster_ml/rakshak_camps_seed.csv", index=False)

    print(f"\n💾 simulated_data.csv      ({df.shape[0]:,} rows)")
    print(f"💾 rakshak_camps_seed.csv  ({len(camps_seed)} rows — Supabase INSERT ready)")
