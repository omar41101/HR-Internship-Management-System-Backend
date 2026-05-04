export const errors = {
  PAYROLL_CONFIG_NOT_FOUND: {
    message: "No active payroll configuration found for the specified year.",
    code: 404,
    errorCode: "PAYROLL_CONFIG_NOT_FOUND",
    suggestion:
      "Please create and activate a payroll configuration for the specified year before generating payrolls.",
  },
  ACTIVE_PAYROLL_CONFIG_EXISTS: {
    message: "An active payroll configuration already exists for this year.",
    code: 400,
    errorCode: "ACTIVE_PAYROLL_CONFIG_EXISTS",
    suggestion:
      "Please deactivate the existing configuration for this year before creating a new one, or update the existing configuration instead.",
  },
};
