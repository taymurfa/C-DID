# Seeding MongoDB with Mock Data

This script loads sample objectives and key results into MongoDB for development and testing.

## Prerequisites

1. Make sure MongoDB is running and accessible
2. Set up your `.env` file with `MONGODB_URI` and `MONGODB_DB_NAME`
3. Activate your Python virtual environment

## Running the Seed Script

From the `backend` directory:

```bash
# Activate virtual environment (if not already active)
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Run the seed script
python seed_data.py
```

## What Gets Created

The script creates:
- 1 Strategic Objective (Digital Transformation & Innovation)
- 2 Functional Objectives (Infrastructure Modernization, Data & Analytics Platform)
- 2 Tactical Objectives (Q1 Cloud Migration Sprint, Q1 Analytics Foundation)
- 11 Key Results across all objectives

## Notes

- The script will **clear existing objectives and key results** before seeding
- All data is created for fiscal year 2026
- The default user ID used is `auth0|seed_user_12345` (you may need to adjust this based on your auth setup)

## Troubleshooting

If you encounter authentication errors, you may need to:
1. Update the `default_user_id` in `seed_data.py` to match an actual user ID from your Auth0 setup
2. Or modify the seed script to use a different approach for user IDs
