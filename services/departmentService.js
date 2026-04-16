import Department from "../models/Department.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { errors } from "../errors/departmentErrors.js";
import { getOne, getAll, createOne, updateOne, deleteOne } from "./handlersFactory.js";

// Get all departments
export const getDepartments = async (queryParams) => {
  const finalQuery = {
    ...queryParams,
    limit: 5,
    sort: "-createdAt",
  };
  return await getAll(Department)(finalQuery);
};

// Get a department by ID
export const getDepartmentById = getOne(Department, errors.DEPARTMENT_NOT_FOUND);

// Add a new department
export const createDepartmentService = async ({ name, description }) => {
  // Validate the name field
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new AppError(
      errors.DEPARTMENT_NAME_REQUIRED.message,
      errors.DEPARTMENT_NAME_REQUIRED.code,
      errors.DEPARTMENT_NAME_REQUIRED.errorCode,
      errors.DEPARTMENT_NAME_REQUIRED.suggestion
    );
  }

  // Check for existing department with the same name
  const existing = await Department.findOne({ name: trimmedName });
  if (existing) {
    throw new AppError(
      errors.DEPARTMENT_ALREADY_EXISTS.message,
      errors.DEPARTMENT_ALREADY_EXISTS.code,
      errors.DEPARTMENT_ALREADY_EXISTS.errorCode,
      errors.DEPARTMENT_ALREADY_EXISTS.suggestion
    );
  }

  const department = await createOne(Department)({
    name: trimmedName,
    description,
  });
  return department;
};

// Update a department
export const updateDepartmentService = async (id, { name, description }) => {
  // Validate the name field
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new AppError(
      errors.DEPARTMENT_NAME_REQUIRED.message,
      errors.DEPARTMENT_NAME_REQUIRED.code,
      errors.DEPARTMENT_NAME_REQUIRED.errorCode,
      errors.DEPARTMENT_NAME_REQUIRED.suggestion
    );
  }

  // Check for department existence
  const department = await Department.findById(id);
  if (!department) {
    throw new AppError(
      errors.DEPARTMENT_NOT_FOUND.message,
      errors.DEPARTMENT_NOT_FOUND.code,
      errors.DEPARTMENT_NOT_FOUND.errorCode,
      errors.DEPARTMENT_NOT_FOUND.suggestion
    );
  }

  // Check the department name uniqueness
  const existing = await Department.findOne({ name: trimmedName });
  if (existing && existing._id.toString() !== id) {
    throw new AppError(
      errors.DEPARTMENT_ALREADY_EXISTS.message,
      errors.DEPARTMENT_ALREADY_EXISTS.code,
      errors.DEPARTMENT_ALREADY_EXISTS.errorCode,
      errors.DEPARTMENT_ALREADY_EXISTS.suggestion
    );
  }

  // Update the department
  const updatedDepartment = await updateOne(Department)(id, {
    name: trimmedName,
    description,
  });

  return updatedDepartment;
};

// Delete a department
export const deleteDepartmentService = async (id) => {
  // Check for department existence
  const department = await Department.findById(id);
  if (!department) {
    throw new AppError(
      errors.DEPARTMENT_NOT_FOUND.message,
      errors.DEPARTMENT_NOT_FOUND.code,
      errors.DEPARTMENT_NOT_FOUND.errorCode,
      errors.DEPARTMENT_NOT_FOUND.suggestion
    );
  }

  // Ensure fallback department exists
  let fallbackDepartment = await Department.findOne({ name: "Not assigned" });
  if (!fallbackDepartment) {
    fallbackDepartment = await Department.create({
      name: "Not assigned",
      description: "Default department for unassigned users",
    });
  }

  // Reassign users
  await User.updateMany(
    { department_id: department._id },
    { $set: { department_id: fallbackDepartment._id } }
  );

  const deletedDepartment = await deleteOne(Department)(id);

  return deletedDepartment; // Return the deleted department for audit logging
};
