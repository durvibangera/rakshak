"""
=============================================================
DISASTER RELIEF: ML MODEL + SMART ALLOCATION ENGINE
=============================================================

Pipeline:
  1. Load simulated data
  2. Feature engineering
  3. Train headcount prediction model (GradientBoosting)
     - One general model across all disaster types
     - Evaluated per phase (surge/plateau/depletion)
  4. Phase transition detector
  5. Smart kit allocation algorithm
  6. Full evaluation report
=============================================================
"""

import numpy as np
import pandas as pd
import warnings
warnings.filterwarnings("ignore")

from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.inspection import permutation_importance
import pickle, os

DATA_PATH  = "/home/claude/disaster_ml/simulated_data.csv"
MODEL_PATH = "/home/claude/disaster_ml/trained_model.pkl"

PHASE_NAMES = {0: "SURGE", 1: "PLATEAU", 2: "DEPLETION"}


# ─────────────────────────────────────────────
# 1. LOAD + FEATURE ENGINEERING
# ─────────────────────────────────────────────

def load_and_engineer(path):
    df = pd.read_csv(path)

    # Ratio features
    df["headcount_to_capacity_ratio"] = df["current_headcount"] / (df["camp_capacity"] + 1)
    df["arrivals_to_departures_ratio"] = (df["arrivals_last_3h"] + 1) / (df["departures_last_3h"] + 1)
    df["pool_to_headcount_ratio"]      = df["remaining_pool_estimate"] / (df["current_headcount"] + 1)

    # Trend acceleration: is velocity itself increasing?
    df = df.sort_values(["camp_id", "disaster_idx", "hour_abs"])
    df["velocity_change"] = df.groupby(["camp_id", "disaster_idx"])["arrival_velocity"].diff().fillna(0)

    # Log-transform skewed features
    for col in ["zone_population_density", "remaining_pool_estimate", "current_headcount"]:
        df[f"log_{col}"] = np.log1p(df[col])

    # Time-of-day as cyclical encoding (sin/cos so 23 is close to 0)
    df["hour_sin"] = np.sin(2 * np.pi * df["hour_of_day"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour_of_day"] / 24)

    # Relative phase progress (0 to 1 within each phase)
    phase_max_hours = {0: 3*24, 1: 4*24, 2: 5*24}
    df["phase_progress"] = df.apply(
        lambda r: r["phase_hour"] / phase_max_hours.get(r["phase"], 72), axis=1
    ).clip(0, 1)

    # Group key for cross-validation (split by disaster event, not row)
    df["group_key"] = df["camp_id"] + "_" + df["disaster_idx"].astype(str)

    return df


FEATURE_COLS = [
    # Camp static
    "camp_capacity", "distance_from_epicenter_km", "zone_population_density",
    "camp_quality_score", "nearby_camps_count",
    # Temporal
    "hour_sin", "hour_cos", "day_of_disaster", "time_since_disaster_hrs",
    "phase", "phase_hour", "phase_progress",
    # Dynamic signals
    "current_headcount", "arrivals_last_1h", "arrivals_last_3h", "arrivals_last_6h",
    "departures_last_1h", "departures_last_3h",
    "arrival_velocity", "velocity_change", "net_flow_last_3h",
    "remaining_pool_estimate",
    # Context
    "road_accessibility", "rescue_ops_active",
    # Engineered ratios
    "headcount_to_capacity_ratio", "arrivals_to_departures_ratio", "pool_to_headcount_ratio",
    "log_zone_population_density", "log_remaining_pool_estimate", "log_current_headcount",
    # One-hot disaster type
    "dtype_flood", "dtype_earthquake", "dtype_conflict",
]

TARGET = "headcount_next_6h"


# ─────────────────────────────────────────────
# 2. TRAIN / EVAL SPLIT (by disaster event)
# ─────────────────────────────────────────────

def train_test_split_by_event(df):
    """
    Split so that entire disaster events are in either train or test.
    This prevents leakage — the model never sees future hours of an
    event it was trained on.
    """
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    groups = df["group_key"]
    train_idx, test_idx = next(gss.split(df, groups=groups))
    return df.iloc[train_idx], df.iloc[test_idx]


# ─────────────────────────────────────────────
# 3. MODEL TRAINING
# ─────────────────────────────────────────────

def train_model(df_train, feature_cols):
    X = df_train[feature_cols].fillna(0)
    y = df_train[TARGET]

    # Gradient Boosting — good at capturing non-linear phase interactions
    # n_estimators=300, learning_rate=0.05 is a solid baseline
    model = GradientBoostingRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
        min_samples_leaf=10,
        subsample=0.8,
        random_state=42,
        validation_fraction=0.1,
        n_iter_no_change=20,   # early stopping
        verbose=0
    )

    print("Training GradientBoostingRegressor...")
    model.fit(X, y)
    print(f"  Trees used: {model.n_estimators_}")
    return model


# ─────────────────────────────────────────────
# 4. EVALUATION
# ─────────────────────────────────────────────

def evaluate(model, df_test, feature_cols):
    X_test = df_test[feature_cols].fillna(0)
    y_test = df_test[TARGET]
    y_pred = model.predict(X_test)
    y_pred = np.clip(y_pred, 0, None)  # headcount can't be negative

    print("\n" + "="*55)
    print("  OVERALL PERFORMANCE")
    print("="*55)
    mae  = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2   = r2_score(y_test, y_pred)
    mape = np.mean(np.abs((y_test - y_pred) / (y_test + 1))) * 100

    print(f"  MAE  (avg people off):   {mae:.1f}")
    print(f"  RMSE:                    {rmse:.1f}")
    print(f"  R²  :                    {r2:.4f}")
    print(f"  MAPE:                    {mape:.1f}%")

    # Per-phase breakdown
    print("\n" + "="*55)
    print("  PER-PHASE PERFORMANCE")
    print("="*55)
    df_eval = df_test.copy()
    df_eval["y_pred"] = y_pred
    df_eval["abs_error"] = np.abs(y_test.values - y_pred)

    for phase_id, phase_name in PHASE_NAMES.items():
        subset = df_eval[df_eval["phase"] == phase_id]
        if len(subset) == 0:
            continue
        p_mae  = subset["abs_error"].mean()
        p_r2   = r2_score(subset[TARGET], subset["y_pred"])
        p_mape = np.mean(np.abs((subset[TARGET] - subset["y_pred"]) / (subset[TARGET] + 1))) * 100
        print(f"  {phase_name:10s} | MAE: {p_mae:6.1f} | R²: {p_r2:.4f} | MAPE: {p_mape:.1f}%  (n={len(subset)})")

    return df_eval


# ─────────────────────────────────────────────
# 5. FEATURE IMPORTANCE
# ─────────────────────────────────────────────

def show_feature_importance(model, feature_cols, top_n=15):
    importances = model.feature_importances_
    feat_df = pd.DataFrame({
        "feature": feature_cols,
        "importance": importances
    }).sort_values("importance", ascending=False).head(top_n)

    print("\n" + "="*55)
    print(f"  TOP {top_n} FEATURE IMPORTANCES")
    print("="*55)
    for _, row in feat_df.iterrows():
        bar = "█" * int(row["importance"] * 400)
        print(f"  {row['feature']:40s} {row['importance']:.4f}  {bar}")


# ─────────────────────────────────────────────
# 6. PHASE TRANSITION DETECTOR
# ─────────────────────────────────────────────

def detect_phase(arrival_history, headcount_history, remaining_pool, window=3, threshold=0.10):
    """
    Stateful rule-based phase detector using rolling velocity.
    Returns: detected phase (0/1/2), confidence, explanation

    Rules:
      - If velocity consistently positive for `window` hours → SURGE
      - If |velocity| < threshold for `window` hours → PLATEAU
      - If velocity consistently negative AND remaining_pool low → DEPLETION
      - False-depletion guard: need 6h of negative velocity, not 3
    """
    if len(arrival_history) < window + 1:
        return 0, 0.5, "Insufficient data — defaulting to SURGE"

    recent_arrivals = arrival_history[-window:]
    velocities = []
    for i in range(1, len(recent_arrivals)):
        v = (recent_arrivals[i] - recent_arrivals[i-1]) / (recent_arrivals[i-1] + 1e-5)
        velocities.append(v)

    avg_velocity = np.mean(velocities)
    velocity_std = np.std(velocities)

    # Pool depletion ratio
    current_headcount = headcount_history[-1] if headcount_history else 0
    pool_ratio = remaining_pool / (current_headcount + remaining_pool + 1e-5)

    # Phase detection logic
    if avg_velocity > threshold:
        confidence = min(0.5 + avg_velocity, 0.99)
        return 0, confidence, f"Avg velocity +{avg_velocity:.2f} → SURGE"

    elif abs(avg_velocity) <= threshold:
        confidence = 1.0 - velocity_std
        return 1, confidence, f"Avg velocity ≈0 ({avg_velocity:.2f}) → PLATEAU"

    else:  # negative velocity
        # False-depletion guard: need longer window
        if len(arrival_history) >= 6:
            long_velocities = []
            for i in range(-5, 0):
                v = (arrival_history[i] - arrival_history[i-1]) / (arrival_history[i-1] + 1e-5)
                long_velocities.append(v)
            if all(v < 0 for v in long_velocities) and pool_ratio < 0.3:
                confidence = min(0.5 + abs(avg_velocity), 0.99)
                return 2, confidence, f"6h negative velocity + low pool ({pool_ratio:.2f}) → DEPLETION"
            else:
                return 1, 0.6, f"Short negative velocity — holding PLATEAU (false-depletion guard)"
        else:
            return 1, 0.5, "Negative velocity but <6h data — holding PLATEAU"


# ─────────────────────────────────────────────
# 7. SMART KIT ALLOCATION ENGINE
# ─────────────────────────────────────────────

def allocate_kits(camps_state, total_kits_available, beta=0.7, buffer_pct=0.15, min_kit_ratio=0.8):
    """
    Given current + predicted headcounts for all camps,
    allocate kits fairly.

    Parameters:
      camps_state: list of dicts with keys:
                   camp_id, current_headcount, predicted_headcount_6h, phase
      total_kits_available: int
      beta: 0-1, how much weight to give prediction vs current (0=current only, 1=prediction only)
      buffer_pct: fraction of kits to hold in reserve
      min_kit_ratio: minimum kits per current person guaranteed

    Returns: DataFrame with allocation per camp + reasoning
    """
    usable_kits = total_kits_available * (1 - buffer_pct)
    reserve     = total_kits_available * buffer_pct

    results = []
    for camp in camps_state:
        cid      = camp["camp_id"]
        current  = camp["current_headcount"]
        pred_6h  = camp["predicted_headcount_6h"]
        phase    = camp["phase"]

        # Effective demand blends current + predicted
        # In depletion phase, reduce β (don't over-allocate to shrinking camps)
        phase_beta = beta if phase < 2 else beta * 0.3
        effective_demand = current + phase_beta * (pred_6h - current)
        effective_demand = max(effective_demand, 0)

        # Minimum allocation floor: protect currently occupied camps
        min_alloc = current * min_kit_ratio

        results.append({
            "camp_id": cid,
            "current_headcount": current,
            "predicted_headcount_6h": pred_6h,
            "phase": PHASE_NAMES[phase],
            "effective_demand": effective_demand,
            "min_alloc_floor": min_alloc,
        })

    df_alloc = pd.DataFrame(results)

    # Proportional allocation from usable pool
    total_demand = df_alloc["effective_demand"].sum()
    df_alloc["proportional_share"] = df_alloc["effective_demand"] / (total_demand + 1e-5)
    df_alloc["kits_proportional"] = df_alloc["proportional_share"] * usable_kits

    # Apply floor constraints — if proportional < floor, top up from remainder
    df_alloc["kits_allocated"] = df_alloc[["kits_proportional", "min_alloc_floor"]].max(axis=1)

    # Re-normalize if floors pushed us over budget
    total_allocated = df_alloc["kits_allocated"].sum()
    if total_allocated > usable_kits:
        df_alloc["kits_allocated"] = df_alloc["kits_allocated"] * (usable_kits / total_allocated)

    df_alloc["kits_allocated"] = df_alloc["kits_allocated"].round().astype(int)
    df_alloc["kits_per_person_now"] = (df_alloc["kits_allocated"] / (df_alloc["current_headcount"] + 1)).round(2)

    # Urgency flag: less than 0.5 kits/person = red alert
    df_alloc["urgency"] = df_alloc["kits_per_person_now"].apply(
        lambda x: "🔴 CRITICAL" if x < 0.5 else ("🟡 LOW" if x < 0.8 else "🟢 OK")
    )

    df_alloc["reserve_kits"] = round(reserve)
    return df_alloc


# ─────────────────────────────────────────────
# 8. DEMO: PREDICT + ALLOCATE FOR LIVE CAMPS
# ─────────────────────────────────────────────

def run_allocation_demo(model, df, feature_cols):
    """
    Simulate a live allocation decision:
    Pick one snapshot per camp from the test set and run allocation.
    """
    print("\n" + "="*55)
    print("  LIVE ALLOCATION DEMO")
    print("="*55)

    # Pick one row per camp_id at hour 30 (mid-surge typically)
    snapshot = df[df["day_of_disaster"] == 2].groupby("camp_id").first().reset_index()
    if len(snapshot) == 0:
        snapshot = df.groupby("camp_id").first().reset_index()

    X_snap = snapshot[feature_cols].fillna(0)
    preds  = model.predict(X_snap)
    preds  = np.clip(preds, 0, None)

    camps_state = []
    for i, row in snapshot.iterrows():
        camps_state.append({
            "camp_id": row["camp_id"],
            "current_headcount": int(row["current_headcount"]),
            "predicted_headcount_6h": int(preds[i]),
            "phase": int(row["phase"])
        })

    total_kits = 1500  # example available kits
    alloc_df = allocate_kits(camps_state, total_kits_available=total_kits)

    print(f"\n  Total kits available: {total_kits}")
    print(f"  Buffer reserved:      {alloc_df['reserve_kits'].iloc[0]}")
    print(f"  Kits for distribution:{total_kits - alloc_df['reserve_kits'].iloc[0]}\n")

    print(alloc_df[[
        "camp_id", "phase", "current_headcount", "predicted_headcount_6h",
        "effective_demand", "kits_allocated", "kits_per_person_now", "urgency"
    ]].to_string(index=False))

    # Phase detector demo
    print("\n" + "="*55)
    print("  PHASE TRANSITION DETECTOR DEMO")
    print("="*55)
    for _, row in snapshot.iterrows():
        # Simulate arrival history from the dataset
        camp_hist = df[
            (df["camp_id"] == row["camp_id"]) &
            (df["disaster_idx"] == row["disaster_idx"])
        ].sort_values("hour_abs")

        arrival_hist  = camp_hist["arrivals_last_1h"].tolist()[:20]
        headcount_hist = camp_hist["current_headcount"].tolist()[:20]
        pool = row["remaining_pool_estimate"]

        detected_phase, conf, reason = detect_phase(arrival_hist, headcount_hist, pool)
        actual_phase = PHASE_NAMES[int(row["phase"])]
        detected_name = PHASE_NAMES[detected_phase]
        match = "✅" if detected_phase == int(row["phase"]) else "⚠️ "
        print(f"  {row['camp_id']} | Actual: {actual_phase:9s} | Detected: {detected_name:9s} {match} | {reason}")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("Loading & engineering features...")
    df = load_and_engineer(DATA_PATH)

    # Make sure all dtype columns exist (in case some weren't in simulation)
    for col in ["dtype_flood", "dtype_earthquake", "dtype_conflict"]:
        if col not in df.columns:
            df[col] = 0

    # Filter feature cols to what's actually in df
    available_features = [c for c in FEATURE_COLS if c in df.columns]
    print(f"  Features: {len(available_features)}")

    df_train, df_test = train_test_split_by_event(df)
    print(f"  Train size: {len(df_train)} | Test size: {len(df_test)}")
    print(f"  Train events: {df_train['group_key'].nunique()} | Test events: {df_test['group_key'].nunique()}")

    model = train_model(df_train, available_features)

    df_eval = evaluate(model, df_test, available_features)

    show_feature_importance(model, available_features)

    run_allocation_demo(model, df_test, available_features)

    # Save model
    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"model": model, "features": available_features}, f)
    print(f"\n💾 Model saved to {MODEL_PATH}")
