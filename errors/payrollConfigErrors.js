export const errors = {
  PAYROLL_CONFIG_NOT_FOUND: {
    message: "No active payroll configuration found for the specified year.",
    code: 404,
    errorCode: "PAYROLL_CONFIG_NOT_FOUND",
    suggestion:
      "Please create and activate a payroll configuration for the specified year before generating payrolls.",
  },
};
