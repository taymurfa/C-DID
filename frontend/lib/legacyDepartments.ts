/**
 * Legacy Mongo department ids (seed_data d1, d2, …) → display names.
 * Must match backend/app/legacy_department_ids.py for Postgres migrated data.
 */
export const LEGACY_MONGO_ID_TO_DISPLAY_NAME: Record<string, string> = {
  d1: 'Engineering',
  d2: 'Sales',
  d3: 'Marketing',
  d4: 'Product',
  d5: 'Customer Success',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Map user.departmentId (Mongo id or Postgres UUID) to the Postgres department UUID
 * when the API returns departments with `_id` + `name`.
 */
export function resolveDepartmentIdForPostgres(
  userDepartmentId: string | null | undefined,
  departments: { _id: string; name: string }[]
): string | null {
  if (userDepartmentId == null || userDepartmentId === '') return null;
  const u = String(userDepartmentId).trim();
  if (UUID_RE.test(u)) return u;
  const display = LEGACY_MONGO_ID_TO_DISPLAY_NAME[u];
  if (display && departments.length > 0) {
    const row = departments.find((d) => d.name === display);
    if (row?._id) return row._id;
  }
  return u;
}
