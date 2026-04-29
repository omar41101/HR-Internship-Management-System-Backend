import User from "../models/User.js";
import Payroll from "../models/Payroll.js";
import Attendance from "../models/Attendance.js";
import { errors } from "../errors/payrollErrors.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import AppError from "../utils/AppError.js";

// THIS FILE IS ABSOLUTELY NOT DONE AT ALL FOR NOW
// IT'S JUST A FIRST DRAFT TO TEST THE PAYROLL CALCULATION LOGIC
// THIS IS STILL A MESS AND IS STILL A WORK IN PROGRESS TO FIGURE OUT THE BEST FORMULA.

// HELPER FUNCTIONS: CALCULATE OVERTIME
const calculateOvertime = async (employeeId, month, year, baseSalary) => {
  const attendances = await Attendance.find({
    userId: employeeId,
    date: {
      $gte: new Date(year, month - 1, 1),
      $lte: new Date(year, month, 0),
    },
  });

  let totalOvertimeHours = 0;

  for (const record of attendances) {
    if (
      ["present", "late"].includes(record.status) &&
      record.checkInTime &&
      record.checkOutTime
    ) {
      const workedHours = getHoursDifference(
        record.checkInTime,
        record.checkOutTime,
      );

      if (workedHours > 8) {
        totalOvertimeHours += workedHours - 8;
      }
    }
  }

  const hourlyRate = baseSalary / 160;

  return totalOvertimeHours * hourlyRate * 1.25;
};

const calculateAbsences = async (employeeId, month, year, baseSalary) => {
  const absences = await Attendance.find({
    userId: employeeId,
    status: "absent",
    date: {
      $gte: new Date(year, month - 1, 1),
      $lte: new Date(year, month, 0),
    },
  });

  const absenceDays = absences.length;

  const dailySalary = baseSalary / 30;

  return absenceDays * dailySalary;
};

// CALCULATE LATE DEDUCTIONS
const SHIFT_START_HOUR = 9;
const SHIFT_START_MINUTE = 0;

const calculateLateHours = (checkInTime) => {
  const [hour, minute] = checkInTime.split(":").map(Number);

  const lateMinutes =
    (hour - SHIFT_START_HOUR) * 60 + (minute - SHIFT_START_MINUTE);

  if (lateMinutes <= 0) return 0;

  // Convert to hours and ROUND UP
  return Math.ceil(lateMinutes / 60);
};

// Calculate late arrivals deduction based on the number of late hours
const calculateLateDeduction = async (employeeId, month, year, baseSalary) => {
  const attendances = await Attendance.find({
    userId: employeeId,
    status: "late",
    date: {
      $gte: new Date(year, month - 1, 1),
      $lte: new Date(year, month, 0),
    },
  });

  let totalLateHours = 0;

  for (const record of attendances) {
    if (record.checkInTime) {
      totalLateHours += calculateLateHours(record.checkInTime);
    }
  }

  // Convert hours → money
  const hourlyRate = baseSalary / 160;

  return totalLateHours * hourlyRate;
};

// CALCULATE PRORATED SALARY FOR NEW JOINERS AND RESIGNED EMPLOYEES
const calculateProratedSalary = async (employeeId, month, year, baseSalary) => {
  const user = await User.findById(employeeId);

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const resignation = await Resignation.findOne({
    employeeId,
    status: { $in: ["approved", "scheduled_exit", "inactive"] },
  });

  const startDate = new Date(
    Math.max(monthStart, user.employment.contractJoinDate),
  );

  const endDate = new Date(
    Math.min(
      monthEnd,
      resignation?.lastWorkingDate || monthEnd,
      user.employment.contractEndDate,
    ),
  );

  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const workedDays = Math.floor((endDate - startDate) / MS_PER_DAY) + 1;

  const totalDaysInMonth = monthEnd.getDate();

  return (baseSalary / totalDaysInMonth) * workedDays;
};

// ------------------------------------------------------------------------------------------------ //

// Payroll calculation
export const calculatePayroll = async (employeeId, month, year, payload) => {
  // Check the employee existence
  const user = await User.findById(employeeId);
  if (!user) {
    throw new AppError(
      commonErrors.USER_NOT_FOUND.message,
      commonErrors.USER_NOT_FOUND.code,
      commonErrors.USER_NOT_FOUND.errorCode,
      commonErrors.USER_NOT_FOUND.suggestion,
    );
  }

  // Check if a payroll record for this employee and month/year already exists
  const existing = await Payroll.findOne({
    employeeId,
    month,
    year,
  });
  if (existing) {
    throw new AppError(
      errors.PAYROLL_ALREADY_EXISTS.message,
      errors.PAYROLL_ALREADY_EXISTS.code,
      errors.PAYROLL_ALREADY_EXISTS.errorCode,
      errors.PAYROLL_ALREADY_EXISTS.suggestion,
    );
  }

  // Get the base salary from the user profile
  const baseSalary = await calculateProratedSalary(
    employeeId,
    month,
    year,
    user.salary.base,
  );
  if (baseSalary <= 0) {
    throw new AppError(
      errors.INVALID_BASE_SALARY.message,
      errors.INVALID_BASE_SALARY.code,
      errors.INVALID_BASE_SALARY.errorCode,
      errors.INVALID_BASE_SALARY.suggestion,
    );
  }

  // Get the bonuses for the month
  const bonusesList = payload.bonuses || [];
  const totalBonuses = bonusesList.reduce((sum, b) => sum + b.amount, 0);

  // Get the overtime hours for the month
  const overtime = await calculateOvertime(employeeId, month, year, baseSalary);

  // Get the absences
  const absences = await calculateAbsences(employeeId, month, year, baseSalary);

  // Get the late arrivals deduction
  const lateArrivals = await calculateLateDeduction(
    employeeId,
    month,
    year,
    baseSalary,
  );

  const allowances =
    user.allowances?.reduce((sum, a) => sum + a.amount, 0) || 0;

  const grossSalary = baseSalary + totalBonuses + overtime + allowances;

  const cnss = grossSalary * 0.0968;

  const tax = grossSalary * 0.1;

  const totalDeductions = cnss + tax + absences + lateArrivals;

  const netSalary = grossSalary - totalDeductions;

  const payroll = await Payroll.create({
    employeeId,
    month,
    year,
    baseSalary,
    earnings: {
      bonuses: [
        {
          type: "manual",
          amount: totalBonuses,
          description: "User global bonus",
        },
      ],
      overtime,
      allowances,
    },
    deductions: {
      cnss,
      tax,
      absences,
      lateArrivals: 0,
    },
    grossSalary,
    netSalary,
    workedDays: 0, // will be computed later
    unpaidLeaveDays: 0,
    status: "draft",
  });

  return {
    status: "Success",
    code: 201,
    message: "Payroll calculated successfully",
    data: payroll,
  };
};

// Add Bonus to a payroll
export const addBonusToPayroll = async (payrollId, payload, adminId) => {
  const payroll = await Payroll.findById(payrollId);
  if (!payroll) {
    throw new AppError("Payroll not found", 404);
  }

  if (payroll.status !== "draft") {
    throw new AppError("Cannot modify payroll after validation", 400);
  }

  const { type, amount, description } = payload;

  if (!amount || amount <= 0) {
    throw new AppError("Invalid bonus amount", 400);
  }

  payroll.earnings.bonuses.push({
    type,
    amount,
    description,
  });

  const totalBonuses = payroll.earnings.bonuses.reduce(
    (sum, b) => sum + b.amount,
    0,
  );

  const grossSalary =
    payroll.baseSalary +
    totalBonuses +
    payroll.earnings.overtime +
    payroll.earnings.allowances;

  const cnss = grossSalary * 0.0968;
  const tax = grossSalary * 0.1;

  const totalDeductions = cnss + tax + payroll.deductions.absences;

  payroll.deductions.cnss = cnss;
  payroll.deductions.tax = tax;
  payroll.grossSalary = grossSalary;
  payroll.netSalary = grossSalary - totalDeductions;

  await payroll.save();

  return {
    status: "Success",
    code: 200,
    message: "Bonus added successfully",
    data: payroll,
  };
};
