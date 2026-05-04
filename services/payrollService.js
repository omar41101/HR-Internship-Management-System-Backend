import User from "../models/User.js";
import Payroll from "../models/Payroll.js";
import PayrollConfig from "../models/PayrollConfig.js";
import { errors } from "../errors/payrollErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors as payrollConfigErrors } from "../errors/payrollConfigErrors.js";
import AppError from "../utils/AppError.js";
import { validateUserStatus } from "../validators/authValidators.js";
import {
  calculateProratedSalary,
  calculateOvertime,
  calculateAbsences,
  calculateLateDeduction,
  calculateUnpaidLeaveDeduction,
  calculateIRPPMonthly,
  calculateCSS,
  round,
  getHourlyRate,
  buildAllowancesSnapshot,
  buildBonusesSnapshot,
} from "../utils/payrollHelpers.js";
import { all } from "axios";

// Payroll calculation for an employee for a given month and year
export const calculatePayroll = async (employeeId, month, year, payload) => {
  // Check the employee existence and status
  const user = await User.findById(employeeId);
  if (!user)
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );

  // Validate the user status (Not Inactive or Blocked)
  validateUserStatus(user);

  // Check if a payroll record for this employee and month already exists
  const existing = await Payroll.findOne({ employeeId, month, year });
  if (existing)
    throw new AppError(
      errors.PAYROLL_ALREADY_EXISTS.message,
      errors.PAYROLL_ALREADY_EXISTS.code,
      errors.PAYROLL_ALREADY_EXISTS.errorCode,
      errors.PAYROLL_ALREADY_EXISTS.suggestion,
    );

  // Get the current payroll configuration for the specified year
  const config = await PayrollConfig.findOne({ year, isActive: true });
  if (!config)
    throw new AppError(
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.message,
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.code,
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.errorCode,
      payrollConfigErrors.PAYROLL_CONFIG_NOT_FOUND.suggestion,
    );

  // Get the base (prorated if necessary) salary for the employee for the specified month and year
  const { proratedSalary: baseSalary, workedDays } =
    await calculateProratedSalary(employeeId, month, year, user);

  if (baseSalary <= 0)
    throw new AppError(
      errors.INVALID_BASE_SALARY.message,
      errors.INVALID_BASE_SALARY.code,
      errors.INVALID_BASE_SALARY.errorCode,
      errors.INVALID_BASE_SALARY.suggestion,
    );

  // Get the hourly rate
  const hourlyRate = getHourlyRate(
    baseSalary,
    config.payroll.standardMonthlyHours,
  );

  // Get the allowances snapshot for the employee
  const {
    snapshot: allowancesSnapshot,
    taxable: taxableAllowances,
    nonTaxable: nonTaxableAllowances,
  } = await buildAllowancesSnapshot(user);

  // Get the bonuses snapshot for the employee
  const systemBonuses = user.bonuses || [];
  const manualBonuses = payload.bonuses || [];

  const allBonuses = [...systemBonuses, ...manualBonuses];
  const { snapshot: bonusesSnapshot, total: totalBonuses } =
    await buildBonusesSnapshot(allBonuses);

  // Calculate overtime compensation
  const { amount: overtimeAmount, hours: overtimeHours } =
    await calculateOvertime(
      employeeId,
      month,
      year,
      baseSalary,
      config,
      hourlyRate,
    );

  // Calculate deductions for absences, late arrivals, and unpaid leave
  const absences = await calculateAbsences(
    employeeId,
    month,
    year,
    baseSalary,
    config,
    hourlyRate,
  );

  const lateArrivals = await calculateLateDeduction(
    employeeId,
    month,
    year,
    baseSalary,
    config,
    hourlyRate,
  );

  const unpaidLeave = await calculateUnpaidLeaveDeduction(
    employeeId,
    month,
    year,
    baseSalary,
    config,
    hourlyRate,
  );

  // Calculate the gross salary
  const grossSalary = round(
    baseSalary + totalBonuses + overtimeAmount + taxableAllowances,
  );

  // Calculate CNSS contribution
  const cnssBase = Math.min(grossSalary, config.cnss.ceiling);
  const cnss = round(cnssBase * config.cnss.rate);

  const taxableIncome = grossSalary - cnss;

  const irpp = calculateIRPPBreakdown(taxableIncome, config, user);

  const netTaxableIncome = taxableIncome - irpp.monthlyTax;

  const css = round(calculateCSS(netTaxableIncome, config));

  // Calculate the total deductions
  const totalDeductions =
    cnss + irpp.monthlyTax + css + absences + lateArrivals + unpaidLeave;

  // Calculate the net salary
  const netSalary = round(grossSalary - totalDeductions + nonTaxableAllowances);

  // Create the payroll record in the database
  const payroll = await Payroll.create({
    employeeId,
    month,
    year,
    baseSalary,
    hourlyRate,
    workedDays,
    earnings: {
      bonuses: bonusesSnapshot,
      allowances: allowancesSnapshot,
      overtime: {
        amount: overtimeAmount,
        hours: overtimeHours,
      },
      totals: {
        bonuses: totalBonuses,
        allowancesTaxable: taxableAllowances,
        allowancesNonTaxable: nonTaxableAllowances,
      },
      total: grossSalary,
    },
    family: irpp.family,
    cnssBase,
    taxableIncome,
    netTaxableIncome,
    fraisProfessionnels: irpp.fraisPro,
    deductions: {
      cnss,
      css,
      irpp: irpp.monthlyTax,
      absences,
      lateArrivals,
      unpaidLeave,
      total: totalDeductions,
    },
    grossSalary,
    netSalary,
    configSnapshot: {
      year,
      cnss: config.cnss,
      css: config.css,
      irpp: config.irpp,
      standardMonthlyHours: config.payroll.standardMonthlyHours,
    },
    status: "draft",
  });

  return payroll;
};
