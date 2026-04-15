import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";
import AppError from "./AppError.js";
import { errors } from "../errors/userErrors.js";

// Resolve role -> role_id
export const resolveRoleId = async (role) => {
  const userrole = await UserRole.findOne({
    name: { $regex: new RegExp(`^${role}$`, "i") },
  });

  if (!userrole) {
    throw new AppError(
      errors.ROLE_NOT_FOUND.message,
      errors.ROLE_NOT_FOUND.code,
      errors.ROLE_NOT_FOUND.errorCode,
      errors.ROLE_NOT_FOUND.suggestion
    );
  }

  return userrole._id;
};

// Resolve department -> department_id
export const resolveDepartmentId = async (department) => {
  const userdepartment = await Department.findOne({
    name: { $regex: new RegExp(`^${department}$`, "i") },
  });

  if (!userdepartment) {
    throw new AppError(
      errors.DEPARTMENT_NOT_FOUND.message,
      errors.DEPARTMENT_NOT_FOUND.code,
      errors.DEPARTMENT_NOT_FOUND.errorCode,
      errors.DEPARTMENT_NOT_FOUND.suggestion
    );
  }

  return userdepartment._id;
};

// Resolve supervisor_email -> supervisor_id
export const resolveSupervisorIdByEmail = async (email) => {
  const supervisor = await User.findOne({ email: email });
  if (!supervisor) {
    throw new AppError(
      errors.SUPERVISOR_NOT_FOUND.message,
      errors.SUPERVISOR_NOT_FOUND.code,
      errors.SUPERVISOR_NOT_FOUND.errorCode,
      errors.SUPERVISOR_NOT_FOUND.suggestion
    );
  }

  return supervisor._id;
};
