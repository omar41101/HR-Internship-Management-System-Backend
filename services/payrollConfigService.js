import PayrollConfig from "../models/PayrollConfig.js";
import { createOne, getAll, getOne } from "./handlersFactory.js";
import { errors } from "../errors/payrollConfigErrors.js";
import AppError from "../utils/AppError.js";

const createPayrollConfigFactory = createOne(PayrollConfig);

// Create a new payroll configuration for a specific year
export const createPayrollConfig = async (data) => {
  // Check if there's already an active configuration for the specified year
  const existingActive = await PayrollConfig.findOne({
    year: data.year,
    isActive: true,
  });
  if (existingActive) {
    throw new AppError(
      errors.ACTIVE_PAYROLL_CONFIG_EXISTS.message,
      errors.ACTIVE_PAYROLL_CONFIG_EXISTS.code,
      errors.ACTIVE_PAYROLL_CONFIG_EXISTS.errorCode,
      errors.ACTIVE_PAYROLL_CONFIG_EXISTS.suggestion,
    );
  }

  // Create a config
  const config = await createPayrollConfigFactory({
    ...data,
    isActive: true,
  });
  return config;
};

// Get all payroll configurations
export const getAllConfigs = async (queryParams) => {
  return await getAll(PayrollConfig)(queryParams);
};

// Get the active payroll configuration for a specific year
export const getActivePayrollConfig = async (year) => {
  const config = await PayrollConfig.findOne({ year, isActive: true });
  if (!config) {
    throw new AppError(
      errors.PAYROLL_CONFIG_NOT_FOUND.message,
      errors.PAYROLL_CONFIG_NOT_FOUND.code,
      errors.PAYROLL_CONFIG_NOT_FOUND.errorCode,
      errors.PAYROLL_CONFIG_NOT_FOUND.suggestion,
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Active payroll configuration retrieved successfully!",
    data: config
  };
};

// Create a new version of the current payroll configuration for a specific year
export const createNewVersion = async (year, newConfig) => {
  // Deactivate the current active config
  await PayrollConfig.updateMany({ year, isActive: true }, { isActive: false });

  // create new version
  const config = await createOne(PayrollConfig)({
    ...newConfig,
    year,
    isActive: true,
  });

  return config;
};

// Toggle the activation status of a payroll configuration
export const togglePayrollConfigActivation = async (id) => {
  // Check the payroll config existence
  const config = await PayrollConfig.findById(id);
  if (!config)
    throw new AppError(
      errors.PAYROLL_CONFIG_NOT_FOUND.message,
      errors.PAYROLL_CONFIG_NOT_FOUND.code,
      errors.PAYROLL_CONFIG_NOT_FOUND.errorCode,
      errors.PAYROLL_CONFIG_NOT_FOUND.suggestion,
    );

  // Deactivate all others for this year (Only one active config per year is allowed)
  await PayrollConfig.updateMany({ year: config.year }, { isActive: false });

  config.isActive = !config.isActive;
  await config.save();

  return {
    status: "Success",
    code: 200,
    message: "Payroll configuration activation toggled successfully!",
    data: config
  };
};
