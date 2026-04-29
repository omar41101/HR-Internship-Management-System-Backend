export const errors = {
  PAYROLL_NOT_FOUND: {
    message: "Payroll record not found.",
    code: 404,  
    errorCode: "PAYROLL_NOT_FOUND",
    suggestion: "Verify the payroll ID and try again."
  },
  PAYROLL_ALREADY_EXISTS: {
    message: "A payroll record for this employee and month already exists.",
    code: 400,
    errorCode: "PAYROLL_ALREADY_EXISTS",
    suggestion: "Check if a payroll record for this employee and month already exists before creating a new one."
  },
  INVALID_BASE_SALARY: {
    message: "The employee does not have a valid base salary for payroll calculation.",
    code: 400,
    errorCode: "INVALID_BASE_SALARY",
    suggestion: "Update the employee's salary information with a valid base salary and try again."
  },
};