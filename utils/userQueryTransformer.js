// A helper function to map: role -> role_id and department -> department_id in the query parameters
import { resolveRoleId, resolveDepartmentId } from "../utils/userResolvers.js";

export const transformUserFilters = async (queryParams) => {
  const newQuery = { ...queryParams };

  if (newQuery.role) {
    newQuery.role_id = await resolveRoleId(newQuery.role);
    delete newQuery.role;
  }

  if (newQuery.department) {
    newQuery.department_id = await resolveDepartmentId(newQuery.department);
    delete newQuery.department;
  }

  return newQuery;
};
