// Custom service for supervisor-related operations
import User from "../models/User.js";
import { getAll } from "./handlersFactory.js";
import { resolveRoleId, resolveDepartmentId} from "../utils/userResolvers.js";

// Sensitive fields that must never leave the backend
const SENSITIVE_FIELDS = "-password -verificationCode -verificationCodeExpires -resetPasswordToken -resetPasswordExpires -loginAttempts -resendCount -resendDate -mustResetPassword";

// Get all active supervisors. Query params example: page=1&keyword=omar
export const getActiveSupervisors = async (queryParams) => {
  const supervisorRoleId = await resolveRoleId("Supervisor");
  const finalQuery = {
    ...queryParams,
    status: "Active",
    role_id: supervisorRoleId,
  };

  // Resolve the department name - Id if we applied a department filter
  if (finalQuery.department) {
    finalQuery.department_id = await resolveDepartmentId(finalQuery.department);
    delete finalQuery.department;
  }

  // Run the generic getAll function + Add the extra filters to get the list of active supervisors
  return getAll(User, null, SENSITIVE_FIELDS)(finalQuery);
};

// Get the 3 recent supervisors
export const getRecentSupervisors = async (queryParams) => {  
  const supervisorRoleId = await resolveRoleId("Supervisor");

  const finalQuery = {
    ...queryParams,
    role_id: supervisorRoleId,
    sort: "-createdAt",
    limit: 3,
  };
  
  // Run the generic getAll function + Add the extra filters to get the list of recent supervisors
  return getAll(User, null, SENSITIVE_FIELDS)(finalQuery);
};
