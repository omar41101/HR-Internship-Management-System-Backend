// Department expected errors
export const errors = {
  DEPARTMENT_NOT_FOUND: {
    message: "Department not found",
    code: 404,
    errorCode: "DEPARTMENT_NOT_FOUND",
    suggestion: "Please check the validity of the department.",
  },
  DEPARTMENT_ALREADY_EXISTS: {
    message: "Department already exists",
    code: 409,
    errorCode: "DEPARTMENT_ALREADY_EXISTS",
    suggestion: "Please use a different department name.",
  },
  NAME_REQUIRED: {
    message: "The name field must be filled!",
    code: 400,
    errorCode: "NAME_REQUIRED",
    suggestion: "Please provide a name for the department.",
  },
};
