"""
=============================================================
RAKSHAK â€” DATABASE INTEGRATION LAYER
=============================================================
Maps the ML pipeline to Rakshak's actual Supabase tables.

Their tables â†’ what we read/write:

  camps         READ  â†’ Camp objects for ML model
  camp_victims  READ  â†’ COUNT per camp = current_headcount
                        timestamp analysis = arrivals_last_Xh
  alerts        READ  â†’ alert_type, risk level per location
  predictions   WRITE â†’ ML headcount prediction output
  camp_alerts   WRITE â†’ flag HIGH severity when camp is danger
  offline_queue READ  â†’ process queued check-ins that came in offline

Supabase client: pip install supabase
=============================================================
"""

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# CONNECTION (replace with real Supabase URL + key)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

SUPABASE_URL = "https://your-project.supabase.co"
SUPABASE_KEY = "your-anon-or-service-role-key"

# from supabase import create_client
# supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# READ: get live camp state
# Combines camps + camp_victims + alerts tables
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def get_live_camps(disaster_lat: float, disaster_lng: float, radius_km: float = 50.0):
    """
    Pulls all active camps and computes live headcount
    from camp_victims COUNT.

    Returns list of dicts ready to instantiate Camp() objects.

    SQL equivalent:
        SELECT
            c.id, c.name, c.operator_name, c.operator_phone,
            c.lat, c.lng, c.radius_km, c.status,
            COUNT(cv.id) AS current_headcount,
            -- arrivals in last 1h
            COUNT(cv.id) FILTER (
                WHERE cv.checked_in_at >= NOW() - INTERVAL '1 hour'
            ) AS arrivals_last_1h,
            -- arrivals in last 3h
            COUNT(cv.id) FILTER (
                WHERE cv.checked_in_at >= NOW() - INTERVAL '3 hours'
            ) AS arrivals_last_3h,
            -- arrivals in last 6h
            COUNT(cv.id) FILTER (
                WHERE cv.checked_in_at >= NOW() - INTERVAL '6 hours'
            ) AS arrivals_last_6h
        FROM camps c
        LEFT JOIN camp_victims cv ON cv.camp_id = c.id
        WHERE c.status = 'active'
        GROUP BY c.id
    """
    # camps = supabase.table("camps").select("*").eq("status","active").execute().data
    # For each camp, count camp_victims:
    # victims = supabase.table("camp_victims").select("camp_id, checked_in_at").execute().data
    pass


def get_latest_alert_for_location(lat: float, lng: float):
    """
    Gets most recent unresolved alert near a location.
    Used to determine alert_type and alert_risk for a camp.

    SQL equivalent:
        SELECT type, risk FROM alerts
        WHERE resolved_at IS NULL
          AND ABS(lat - $lat) < 0.1 AND ABS(lng - $lng) < 0.1
        ORDER BY created_at DESC LIMIT 1
    """
    # result = supabase.table("alerts") \
    #     .select("type, risk") \
    #     .is_("resolved_at", "null") \
    #     .order("created_at", desc=True) \
    #     .limit(1) \
    #     .execute()
    # return result.data[0] if result.data else {"type":"FLOOD","risk":"MEDIUM"}
    pass


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# WRITE: predictions table
# After ML model runs, write predicted headcount back
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def write_prediction(camp_id: str, lat: float, lng: float,
                     camp_name: str, predicted_headcount: int,
                     current_headcount: int, alert_risk: str, alert_type: str):
    """
    Writes ML prediction to Rakshak predictions table.

    Maps our ML output â†’ their predictions schema:
        lat, lng, location_name, overall_risk,
        flood_risk, earthquake_risk, landslide_risk, cyclone_risk,
        raw_data (stores headcount predictions as JSON)
    """
    raw_data = {
        "camp_id":               camp_id,
        "current_headcount":     current_headcount,
        "predicted_headcount_24h": predicted_headcount,
        "prediction_model":      "GradientBoostingRegressor",
        "model_version":         "rakshak_v1",
    }

    payload = {
        "lat":              lat,
        "lng":              lng,
        "location_name":    camp_name,
        "overall_risk":     alert_risk,
        "flood_risk":       alert_risk if alert_type == "FLOOD"      else "LOW",
        "earthquake_risk":  alert_risk if alert_type == "EARTHQUAKE" else "LOW",
        "landslide_risk":   alert_risk if alert_type == "LANDSLIDE"  else "LOW",
        "cyclone_risk":     alert_risk if alert_type == "CYCLONE"    else "LOW",
        "raw_data":         raw_data,
    }

    # supabase.table("predictions").insert(payload).execute()
    print(f"  [DB] predictions INSERT: {camp_name} â†’ predicted {predicted_headcount} people")
    return payload


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# WRITE: camp_alerts table
# When a camp goes DANGER, insert a camp_alert for operator review
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def flag_camp_danger(camp_id: str, camp_lat: float, camp_lng: float,
                     camp_name: str, disaster_type: str, reason: str):
    """
    Inserts into camp_alerts with severity=HIGH, status=pending.
    Camp operator sees this in their dashboard and approves/rejects.

    Maps to their camp_alerts schema:
        camp_id, disaster_type, severity, lat, lng,
        location_name, description, status='pending'
    """
    payload = {
        "camp_id":       camp_id,
        "disaster_type": disaster_type,
        "severity":      "HIGH",
        "lat":           camp_lat,
        "lng":           camp_lng,
        "location_name": camp_name,
        "description":   reason,
        "status":        "pending",
    }
    # supabase.table("camp_alerts").insert(payload).execute()
    print(f"  [DB] camp_alerts INSERT: {camp_name} | severity=HIGH | status=pending")
    return payload


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# READ: offline_queue table
# Process any check-ins that happened offline
# These need to be counted in headcount after sync
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def process_offline_queue(camp_id: str):
    """
    Reads unsynced offline_queue rows for a camp.
    These are check-ins that happened when operator had no internet
    (SMS fallback). Once synced, they update camp_victims.

    SQL equivalent:
        SELECT * FROM offline_queue
        WHERE camp_id = $camp_id AND synced = false
        ORDER BY created_at ASC
    """
    # result = supabase.table("offline_queue") \
    #     .select("*") \
    #     .eq("camp_id", camp_id) \
    #     .eq("synced", False) \
    #     .order("created_at") \
    #     .execute()
    # for row in result.data:
    #     # process the payload (checkin action)
    #     # mark as synced
    #     supabase.table("offline_queue").update({"synced":True,"synced_at":"NOW()"}) \
    #         .eq("id", row["id"]).execute()
    pass


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# WRITE: kit dispatch to camp
# Not in Rakshak schema â€” store in raw_data of predictions
# or add a new kit_dispatches table later
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def write_kit_dispatch(camp_id: str, camp_lat: float, camp_lng: float,
                       camp_name: str, kits_allocated: int,
                       predicted_headcount: int, urgency: str, alert_type: str):
    """
    Kit dispatch is stored back into predictions.raw_data for now
    since Rakshak doesn't have a kit table yet.
    When NGO schema is added, this writes to kit_dispatch_orders instead.
    """
    raw_data = {
        "camp_id":           camp_id,
        "kits_allocated":    kits_allocated,
        "predicted_headcount_at_delivery": predicted_headcount,
        "urgency":           urgency,
        "dispatch_source":   "super_admin_allocation",
    }
    payload = {
        "lat":           camp_lat,
        "lng":           camp_lng,
        "location_name": f"{camp_name} [KIT DISPATCH]",
        "overall_risk":  "HIGH" if urgency == "ðŸ”´ CRITICAL" else "MEDIUM",
        "flood_risk":    "HIGH" if alert_type == "FLOOD" else "LOW",
        "earthquake_risk": "HIGH" if alert_type == "EARTHQUAKE" else "LOW",
        "landslide_risk":  "HIGH" if alert_type == "LANDSLIDE" else "LOW",
        "cyclone_risk":    "HIGH" if alert_type == "CYCLONE" else "LOW",
        "raw_data":      raw_data,
    }
    # supabase.table("predictions").insert(payload).execute()
    print(f"  [DB] kit dispatch logged: {camp_name} â† {kits_allocated} kits ({urgency})")
    return payload


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# TABLE MAPPING SUMMARY
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

TABLE_MAPPING = {
    "camps": {
        "used_by":   "ML model reads camp static features",
        "our_reads": ["id","name","lat","lng","radius_km","status","operator_phone"],
        "we_write":  "Nothing â€” read only",
    },
    "camp_victims": {
        "used_by":   "Headcount derivation â€” COUNT per camp_id",
        "our_reads": ["camp_id","checked_in_at","checked_in_via"],
        "we_write":  "Nothing â€” read only",
        "note":      "checked_in_at timestamps â†’ arrivals_last_1h/3h/6h for ML",
    },
    "alerts": {
        "used_by":   "Determines alert_type + alert_risk â†’ maps to ML phase",
        "our_reads": ["type","risk","lat","lng","resolved_at"],
        "we_write":  "Nothing â€” read only",
    },
    "predictions": {
        "used_by":   "We write ML output here",
        "our_reads": "Nothing",
        "we_write":  ["lat","lng","location_name","overall_risk",
                      "flood_risk","earthquake_risk","landslide_risk","cyclone_risk",
                      "raw_data (headcount predictions + kit dispatch)"],
    },
    "camp_alerts": {
        "used_by":   "We insert when a camp goes HIGH risk / DANGER",
        "our_reads": "Nothing",
        "we_write":  ["camp_id","disaster_type","severity=HIGH",
                      "lat","lng","description","status=pending"],
    },
    "offline_queue": {
        "used_by":   "Read unsynced check-ins to correct headcount",
        "our_reads": ["camp_id","action_type","payload","synced"],
        "we_write":  "synced=True after processing",
    },
    "users": {
        "used_by":   "Not directly used by ML",
        "our_reads": "Nothing",
        "we_write":  "Nothing",
    },
    "call_logs": {
        "used_by":   "Not used by ML",
        "our_reads": "Nothing",
        "we_write":  "Nothing",
    },
}

if __name__ == "__main__":
    print("\nRAKSHAK TABLE MAPPING")
    print("="*60)
    for table, info in TABLE_MAPPING.items():
        print(f"\n  {table}")
        print(f"    Used by : {info['used_by']}")
        reads = info['our_reads']
        writes = info['we_write']
        if isinstance(reads, list):
            print(f"    We read : {', '.join(reads)}")
        else:
            print(f"    We read : {reads}")
        if isinstance(writes, list):
            print(f"    We write: {', '.join(writes)}")
        else:
            print(f"    We write: {writes}")
        if "note" in info:
            print(f"    Note    : {info['note']}")
