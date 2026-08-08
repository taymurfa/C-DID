"""Legacy Mongo department _id values from seed_data (d1, d2, …) → display names.

Used to map user/objective departmentId strings to Postgres departments after Mongo→Postgres migration.
"""

# Must match backend/seed_data.py departments and migrated Department.display_name values.
LEGACY_MONGO_ID_TO_DISPLAY_NAME: dict[str, str] = {
    "d1": "Engineering",
    "d2": "Sales",
    "d3": "Marketing",
    "d4": "Product",
    "d5": "Customer Success",
}
