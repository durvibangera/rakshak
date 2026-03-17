# Seed Scripts

## Smart Allocation Demo

**Purpose:** Creates a realistic disaster scenario to demonstrate the ML-powered smart allocation model.

### What it creates:

- **8 camps** with varied conditions:
  - 3 SURGE camps (rapid growth, HIGH risk) - e.g., coastal flooding areas
  - 2 PLATEAU camps (stable, MEDIUM risk) - e.g., community halls
  - 3 DEPLETION camps (declining, LOW risk) - e.g., safe zones where people are leaving
  
- **2,925 total victims** distributed across camps with realistic check-in times

- **1,000 kits** in inventory ready for allocation

- **1 active disaster alert** (Severe Flooding)

### How to run:

```bash
cd rakshak
npm run seed:allocation
```

### Expected allocation behavior:

The smart allocation model uses the formula:
```
effective_demand = current_headcount + 0.7 * (predicted_headcount - current_headcount)
```

This means:
- **SURGE camps** (e.g., Airport Hub: 650 → 1100) get MORE kits because predicted growth is high
- **PLATEAU camps** (e.g., Community Hall: 320 → 380) get MODERATE kits
- **DEPLETION camps** (e.g., Temple: 240 → 200) get FEWER kits because people are leaving

The model also:
- Holds a 15% reserve buffer (150 kits)
- Distributes remaining 850 kits proportionally by effective demand
- Flags camps as CRITICAL if kits/person < 0.5

### After seeding:

1. Open http://localhost:3000/super-admin/dashboard
2. Click **"Run Predictions"** to generate 24h forecasts for all camps
3. Click **"Run Smart Allocation"** to see the ML distribution
4. Compare the allocation results:
   - SURGE camps should get the most kits
   - DEPLETION camps should get the least
   - Check the "Kits Per Person" and "Urgency" columns

### Clean up:

The script automatically clears existing demo data before seeding, so you can run it multiple times safely.
