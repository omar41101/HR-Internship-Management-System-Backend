import mongoose from "mongoose";

const payrollSchema = new mongoose.Schema(
  {
    employeeId: {
      // Reference to the Employee for whom this payroll record is created
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    month: {
      // 1-12
      type: Number,
      min: 1,
      max: 12,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    baseSalary: {
      // Fixed monthly salary for the employee
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "DT",
    },
    earnings: {
      bonuses: [
        {
          type: {
            type: String,
            enum: ["project", "child", "performance", "manual"],
            required: true,
          },
          amount: {
            type: Number,
            required: true,
            min: 0,
          },
          description: {
            type: String,
            default: "",
          },
        },
      ],
      overtime: {
        // Overtime pay: Additional compensation for hours worked beyond the standard work hours
        type: Number,
        default: 0,
      },
      allowances: [
        {
          type: {
            type: String,
            enum: ["transport", "meal", "housing", "other"],
            required: true,
          },
          amount: {
            type: Number,
            required: true,
            min: 0,
          },
        },
      ],
    },
    deductions: {
      cnss: {
        // 9.68% of the gross salary accorfing to the current regulations in Tunisia
        type: Number,
        default: 0,
      },
      tax: {
        // IRPP
        type: Number,
        default: 0,
      },
      absences: {
        type: Number,
        default: 0,
      },
      lateArrivals: {
        type: Number,
        default: 0,
      },
    },
    grossSalary: {
      type: Number,
      required: true,
    },
    netSalary: {
      type: Number,
      required: true,
    },
    workedDays: {
      // Number of days the employee actually worked during the month (excluding absences and unpaid leave)
      type: Number,
      default: 0,
    },
    unpaidLeaveDays: {
      // Number of days the employee took as unpaid leave during the month
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["draft", "validated", "paid"],
      default: "draft",
    },
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    validatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Add an index to ensure on payroll per month and year for each employee
payrollSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model("Payroll", payrollSchema);
