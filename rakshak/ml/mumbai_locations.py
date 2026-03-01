"""
=============================================================
MUMBAI CAMP LOCATIONS + SAFE ZONE MIGRATION ENGINE
=============================================================

Simulates:
  1. 8 refugee camp locations across Mumbai (real coordinates)
  2. ~25 probable safe zones (schools, hospitals, community halls,
     colleges) spread across Mumbai
  3. Migration engine: if a camp is flagged as DANGER,
     find closest SAFE zone that has capacity

Distance calculated using Haversine formula (accurate for short distances).
=============================================================
"""

import numpy as np
import pandas as pd
from math import radians, sin, cos, sqrt, atan2
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from datetime import datetime


# ─────────────────────────────────────────────
# HAVERSINE DISTANCE
# ─────────────────────────────────────────────

def haversine_km(lat1, lng1, lat2, lng2) -> float:
    """Returns distance in km between two lat/lng points."""
    R = 6371.0
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


# ─────────────────────────────────────────────
# DATA CLASSES
# ─────────────────────────────────────────────

@dataclass
class CampLocation:
    camp_id: str
    name: str
    area: str
    lat: float
    lng: float
    current_headcount: int
    capacity: int
    status: str = "ACTIVE"          # ACTIVE / DANGER / EVACUATED
    danger_reason: str = ""
    assigned_safe_zone: Optional[str] = None

    def flag_danger(self, reason: str):
        self.status = "DANGER"
        self.danger_reason = reason
        print(f"  🚨 [{self.camp_id}] {self.name} flagged DANGER: {reason}")


@dataclass
class SafeZone:
    zone_id: str
    name: str
    zone_type: str                  # school / hospital / community_hall / college / stadium
    area: str
    lat: float
    lng: float
    capacity: int
    current_occupancy: int = 0
    is_safe: bool = True
    facilities: List[str] = field(default_factory=list)

    @property
    def available_capacity(self) -> int:
        return max(0, self.capacity - self.current_occupancy)

    @property
    def occupancy_pct(self) -> float:
        return round(self.current_occupancy / self.capacity * 100, 1) if self.capacity > 0 else 0


# ─────────────────────────────────────────────
# SIMULATED CAMP LOCATIONS — MUMBAI
# Real Mumbai neighborhoods, realistic flood-prone areas
# ─────────────────────────────────────────────

CAMP_LOCATIONS = [
    CampLocation(
        camp_id="CAMP_01", name="Dharavi Relief Camp",
        area="Dharavi", lat=19.0422, lng=72.8533,
        current_headcount=420, capacity=600,
        # Dharavi — low-lying, flood-prone, densely packed
    ),
    CampLocation(
        camp_id="CAMP_02", name="Kurla West Relief Camp",
        area="Kurla", lat=19.0726, lng=72.8795,
        current_headcount=310, capacity=500,
        # Kurla — near Mithi river, historically floods badly
    ),
    CampLocation(
        camp_id="CAMP_03", name="Andheri East Relief Camp",
        area="Andheri East", lat=19.1136, lng=72.8697,
        current_headcount=185, capacity=350,
        # Andheri East — near SEEPZ, flood risk
    ),
    CampLocation(
        camp_id="CAMP_04", name="Bandra Reclamation Camp",
        area="Bandra West", lat=19.0596, lng=72.8295,
        current_headcount=95, capacity=200,
        # Bandra reclamation area — coastal flood risk
    ),
    CampLocation(
        camp_id="CAMP_05", name="Sion Relief Camp",
        area="Sion", lat=19.0430, lng=72.8625,
        current_headcount=270, capacity=400,
        # Sion — low elevation, near creek
    ),
    CampLocation(
        camp_id="CAMP_06", name="Malad West Relief Camp",
        area="Malad West", lat=19.1872, lng=72.8484,
        current_headcount=140, capacity=300,
        # Malad — near Malad creek, flooding common
    ),
    CampLocation(
        camp_id="CAMP_07", name="Chembur Relief Camp",
        area="Chembur", lat=19.0622, lng=72.9005,
        current_headcount=230, capacity=450,
        # Chembur — eastern suburb, industrial flood zone
    ),
    CampLocation(
        camp_id="CAMP_08", name="Govandi Relief Camp",
        area="Govandi", lat=19.0742, lng=72.9186,
        current_headcount=380, capacity=550,
        # Govandi — near Deonar, highly flood vulnerable
    ),
]


# ─────────────────────────────────────────────
# SIMULATED SAFE ZONES — MUMBAI
# Schools, hospitals, colleges, community halls
# Deliberately placed in higher elevation / safer zones
# ─────────────────────────────────────────────

SAFE_ZONES = [
    # ── HOSPITALS ──
    SafeZone("SZ_H01", "Lilavati Hospital & Research Centre",
             "hospital", "Bandra West",
             lat=19.0502, lng=72.8238, capacity=800,
             facilities=["medical", "power_backup", "water", "kitchen"]),

    SafeZone("SZ_H02", "Kokilaben Dhirubhai Ambani Hospital",
             "hospital", "Andheri West",
             lat=19.1347, lng=72.8270, capacity=600,
             facilities=["medical", "power_backup", "water", "kitchen"]),

    SafeZone("SZ_H03", "Lokmanya Tilak Municipal Hospital (Sion Hospital)",
             "hospital", "Sion",
             lat=19.0399, lng=72.8576, capacity=500,
             facilities=["medical", "power_backup", "water"]),

    SafeZone("SZ_H04", "Rajawadi Government Hospital",
             "hospital", "Ghatkopar",
             lat=19.0786, lng=72.9097, capacity=400,
             facilities=["medical", "power_backup", "water"]),

    SafeZone("SZ_H05", "Seven Hills Hospital",
             "hospital", "Marol, Andheri East",
             lat=19.1063, lng=72.8800, capacity=450,
             facilities=["medical", "power_backup", "water", "kitchen"]),

    # ── SCHOOLS (large grounds, usable as shelters) ──
    SafeZone("SZ_S01", "St. Stanislaus High School",
             "school", "Bandra West",
             lat=19.0643, lng=72.8312, capacity=700,
             facilities=["toilets", "water", "open_ground"]),

    SafeZone("SZ_S02", "Don Bosco High School",
             "school", "Matunga",
             lat=19.0238, lng=72.8622, capacity=600,
             facilities=["toilets", "water", "open_ground"]),

    SafeZone("SZ_S03", "Holy Cross High School",
             "school", "Kurla West",
             lat=19.0769, lng=72.8742, capacity=500,
             facilities=["toilets", "water"]),

    SafeZone("SZ_S04", "Ryan International School",
             "school", "Malad West",
             lat=19.1921, lng=72.8445, capacity=650,
             facilities=["toilets", "water", "open_ground", "kitchen"]),

    SafeZone("SZ_S05", "IES Modern English School",
             "school", "Dadar",
             lat=19.0197, lng=72.8422, capacity=450,
             facilities=["toilets", "water"]),

    SafeZone("SZ_S06", "St. Xavier's High School",
             "school", "Fort",
             lat=18.9387, lng=72.8353, capacity=400,
             facilities=["toilets", "water", "open_ground"]),

    # ── COLLEGES ──
    SafeZone("SZ_C01", "Mithibai College",
             "college", "Vile Parle West",
             lat=19.1072, lng=72.8274, capacity=900,
             facilities=["toilets", "water", "open_ground", "canteen"]),

    SafeZone("SZ_C02", "SNDT Women's University",
             "college", "Santacruz West",
             lat=19.0827, lng=72.8337, capacity=750,
             facilities=["toilets", "water", "canteen", "open_ground"]),

    SafeZone("SZ_C03", "K.J. Somaiya College",
             "college", "Vidyavihar",
             lat=19.0731, lng=72.9079, capacity=800,
             facilities=["toilets", "water", "canteen", "open_ground"]),

    SafeZone("SZ_C04", "Thadomal Shahani Engineering College",
             "college", "Bandra West",
             lat=19.0536, lng=72.8394, capacity=600,
             facilities=["toilets", "water", "canteen"]),

    SafeZone("SZ_C05", "Vivekanand Education Society",
             "college", "Chembur",
             lat=19.0524, lng=72.8959, capacity=700,
             facilities=["toilets", "water", "canteen", "open_ground"]),

    # ── COMMUNITY HALLS / MUNICIPAL GROUNDS ──
    SafeZone("SZ_M01", "Shivaji Park Municipal Ground",
             "community_hall", "Dadar",
             lat=19.0282, lng=72.8414, capacity=2000,
             facilities=["open_ground", "water", "toilets"]),

    SafeZone("SZ_M02", "MMRDA Grounds BKC",
             "community_hall", "Bandra Kurla Complex",
             lat=19.0607, lng=72.8700, capacity=3000,
             facilities=["open_ground", "water", "power_backup"]),

    SafeZone("SZ_M03", "Andheri Sports Complex",
             "community_hall", "Andheri West",
             lat=19.1185, lng=72.8374, capacity=1200,
             facilities=["open_ground", "water", "toilets", "kitchen"]),

    SafeZone("SZ_M04", "Mulund Municipal Grounds",
             "community_hall", "Mulund West",
             lat=19.1757, lng=72.9560, capacity=1500,
             facilities=["open_ground", "water", "toilets"]),

    SafeZone("SZ_M05", "Borivali National Park Entry Ground",
             "community_hall", "Borivali",
             lat=19.2295, lng=72.8694, capacity=2500,
             facilities=["open_ground", "water", "toilets"]),

    # ── STADIUMS ──
    SafeZone("SZ_ST01", "Wankhede Stadium",
             "stadium", "Marine Lines",
             lat=18.9388, lng=72.8258, capacity=2500,
             facilities=["open_ground", "water", "toilets", "power_backup", "kitchen"]),

    SafeZone("SZ_ST02", "DY Patil Stadium",
             "stadium", "Nerul (accessible from Govandi)",
             lat=19.0442, lng=73.0155, capacity=2000,
             facilities=["open_ground", "water", "toilets", "power_backup"]),

    SafeZone("SZ_ST03", "Cooperage Football Ground",
             "stadium", "Colaba",
             lat=18.9268, lng=72.8309, capacity=1000,
             facilities=["open_ground", "water", "toilets"]),
]


# ─────────────────────────────────────────────
# MIGRATION ENGINE
# ─────────────────────────────────────────────

def find_migration_options(
    camp: CampLocation,
    safe_zones: List[SafeZone],
    top_n: int = 3,
    max_distance_km: float = 20.0
) -> List[dict]:
    """
    For a DANGER camp, find the top N closest SAFE zones
    that have enough capacity for the camp's current headcount.

    Returns ranked list with distance, capacity info, and facilities.
    """
    options = []

    for zone in safe_zones:
        if not zone.is_safe:
            continue

        dist = haversine_km(camp.lat, camp.lng, zone.lat, zone.lng)

        if dist > max_distance_km:
            continue

        can_absorb = zone.available_capacity >= camp.current_headcount
        partial    = zone.available_capacity > 0 and not can_absorb

        options.append({
            "zone_id":            zone.zone_id,
            "name":               zone.name,
            "zone_type":          zone.zone_type,
            "area":               zone.area,
            "lat":                zone.lat,
            "lng":                zone.lng,
            "distance_km":        round(dist, 2),
            "available_capacity": zone.available_capacity,
            "current_occupancy":  zone.current_occupancy,
            "total_capacity":     zone.capacity,
            "occupancy_pct":      zone.occupancy_pct,
            "can_fully_absorb":   can_absorb,
            "partial_only":       partial,
            "facilities":         ", ".join(zone.facilities),
            "recommendation":     "✅ RECOMMENDED" if can_absorb else
                                  ("⚠️  PARTIAL"    if partial else "❌ FULL"),
        })

    # Sort: fully absorbing first, then by distance
    options.sort(key=lambda x: (not x["can_fully_absorb"], x["distance_km"]))
    return options[:top_n]


def run_migration_plan(
    camps: List[CampLocation],
    safe_zones: List[SafeZone],
    danger_camp_ids: List[str]
) -> pd.DataFrame:
    """
    Given a list of camp IDs that have become dangerous,
    generate a full migration plan.
    """
    print("\n" + "="*65)
    print("  MIGRATION PLAN")
    print("="*65)

    all_results = []

    for camp in camps:
        if camp.camp_id not in danger_camp_ids:
            continue

        print(f"\n  🚨 {camp.camp_id} — {camp.name} ({camp.area})")
        print(f"     People to move : {camp.current_headcount}")
        print(f"     Danger reason  : {camp.danger_reason}")
        print(f"     Coordinates    : {camp.lat}, {camp.lng}")
        print(f"\n     Top migration options:")

        options = find_migration_options(camp, safe_zones, top_n=3)

        if not options:
            print("     ❌ No safe zones found within range!")
            continue

        for i, opt in enumerate(options, 1):
            print(f"\n     Option {i}: {opt['name']}")
            print(f"       Type       : {opt['zone_type'].replace('_',' ').title()}")
            print(f"       Area       : {opt['area']}")
            print(f"       Distance   : {opt['distance_km']} km")
            print(f"       Capacity   : {opt['available_capacity']} available "
                  f"/ {opt['total_capacity']} total ({opt['occupancy_pct']}% full)")
            print(f"       Facilities : {opt['facilities']}")
            print(f"       Status     : {opt['recommendation']}")

            all_results.append({
                "danger_camp_id":   camp.camp_id,
                "danger_camp_name": camp.name,
                "danger_camp_area": camp.area,
                "people_to_move":   camp.current_headcount,
                "danger_reason":    camp.danger_reason,
                "option_rank":      i,
                **opt
            })

        # Assign best option
        best = options[0]
        camp.assigned_safe_zone = best["zone_id"]
        camp.status = "EVACUATED" if best["can_fully_absorb"] else "DANGER"
        print(f"\n     ➡️  ASSIGNED: {best['name']} ({best['distance_km']} km away)")

        # Update safe zone occupancy
        for zone in safe_zones:
            if zone.zone_id == best["zone_id"]:
                zone.current_occupancy += camp.current_headcount
                break

    return pd.DataFrame(all_results)


# ─────────────────────────────────────────────
# DISTANCE MATRIX — all camps vs all safe zones
# ─────────────────────────────────────────────

def build_distance_matrix(
    camps: List[CampLocation],
    safe_zones: List[SafeZone]
) -> pd.DataFrame:
    rows = []
    for camp in camps:
        for zone in safe_zones:
            dist = haversine_km(camp.lat, camp.lng, zone.lat, zone.lng)
            rows.append({
                "camp_id":    camp.camp_id,
                "camp_name":  camp.name,
                "camp_area":  camp.area,
                "zone_id":    zone.zone_id,
                "zone_name":  zone.name,
                "zone_type":  zone.zone_type,
                "zone_area":  zone.area,
                "distance_km": round(dist, 2),
                "zone_capacity": zone.capacity,
            })
    return pd.DataFrame(rows).sort_values(["camp_id", "distance_km"])


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

if __name__ == "__main__":

    print("\n" + "="*65)
    print("  MUMBAI DISASTER CAMPS + SAFE ZONE SYSTEM")
    print("="*65)

    # ── Print all camp locations ──
    print("\n📍 CAMP LOCATIONS:")
    print(f"  {'ID':8s} {'Area':20s} {'Headcount':>10s} {'Capacity':>10s} {'Lat':>10s} {'Lng':>10s}")
    print("  " + "─"*62)
    for c in CAMP_LOCATIONS:
        print(f"  {c.camp_id:8s} {c.area:20s} {c.current_headcount:>10d} "
              f"{c.capacity:>10d} {c.lat:>10.4f} {c.lng:>10.4f}")

    # ── Print safe zones ──
    print(f"\n🏥 SAFE ZONES ({len(SAFE_ZONES)} total):")
    for t in ["hospital", "school", "college", "community_hall", "stadium"]:
        zones = [z for z in SAFE_ZONES if z.zone_type == t]
        total_cap = sum(z.capacity for z in zones)
        print(f"  {t.replace('_',' ').title():20s}: {len(zones)} zones, "
              f"{total_cap:,} total capacity")

    # ── Simulate some camps becoming danger zones ──
    print("\n\n⚠️  SIMULATING DANGER EVENTS...")
    CAMP_LOCATIONS[0].flag_danger("Rising floodwater — 2ft in last hour")       # Dharavi
    CAMP_LOCATIONS[2].flag_danger("Structural damage to camp buildings")          # Andheri East
    CAMP_LOCATIONS[7].flag_danger("Sewage overflow, health hazard declared")      # Govandi

    danger_ids = [c.camp_id for c in CAMP_LOCATIONS if c.status == "DANGER"]

    # ── Run migration plan ──
    migration_df = run_migration_plan(CAMP_LOCATIONS, SAFE_ZONES, danger_ids)

    # ── Summary table ──
    print("\n\n" + "="*65)
    print("  MIGRATION SUMMARY")
    print("="*65)
    summary = migration_df[migration_df["option_rank"] == 1][[
        "danger_camp_name", "people_to_move", "name",
        "distance_km", "available_capacity", "recommendation"
    ]].rename(columns={
        "danger_camp_name": "From Camp",
        "people_to_move":   "People",
        "name":             "→ Migrate To",
        "distance_km":      "Dist (km)",
        "available_capacity": "Avail. Cap",
        "recommendation":   "Status"
    })
    print(summary.to_string(index=False))

    # ── Distance matrix ──
    print("\n\n" + "="*65)
    print("  CLOSEST SAFE ZONE PER CAMP (top 3 per camp)")
    print("="*65)
    dist_matrix = build_distance_matrix(CAMP_LOCATIONS, SAFE_ZONES)
    top3 = dist_matrix.groupby("camp_id").head(3)[
        ["camp_id", "camp_area", "zone_name", "zone_type", "zone_area", "distance_km", "zone_capacity"]
    ]
    print(top3.to_string(index=False))

    # ── Save outputs ──
    dist_matrix.to_csv("/home/claude/disaster_ml/distance_matrix.csv", index=False)
    migration_df.to_csv("/home/claude/disaster_ml/migration_plan.csv", index=False)

    # Save camp + zone data as structured JSON for frontend/API use
    import json

    camps_json = [{
        "camp_id": c.camp_id, "name": c.name, "area": c.area,
        "lat": c.lat, "lng": c.lng,
        "current_headcount": c.current_headcount, "capacity": c.capacity,
        "status": c.status, "danger_reason": c.danger_reason,
        "assigned_safe_zone": c.assigned_safe_zone
    } for c in CAMP_LOCATIONS]

    zones_json = [{
        "zone_id": z.zone_id, "name": z.name, "zone_type": z.zone_type,
        "area": z.area, "lat": z.lat, "lng": z.lng,
        "capacity": z.capacity, "current_occupancy": z.current_occupancy,
        "available_capacity": z.available_capacity, "is_safe": z.is_safe,
        "facilities": z.facilities
    } for z in SAFE_ZONES]

    with open("/home/claude/disaster_ml/mumbai_camps.json", "w") as f:
        json.dump(camps_json, f, indent=2)
    with open("/home/claude/disaster_ml/mumbai_safe_zones.json", "w") as f:
        json.dump(zones_json, f, indent=2)

    print("\n\n💾 Files saved:")
    print("   distance_matrix.csv   — all camps × all safe zones with distances")
    print("   migration_plan.csv    — full migration options for danger camps")
    print("   mumbai_camps.json     — camp locations for API/frontend")
    print("   mumbai_safe_zones.json — safe zone data for API/frontend")
