import mongoose from "mongoose";

const bonusTypeSchema = new mongoose.Schema({
  code: {
    // A unique code to identify the bonus type (e.g., "PERFORMANCE", "ATTENDANCE", "HOLIDAY")
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  isTaxable: {
    // Whether the bonus is subject to income tax (IRPP) and social contributions (CNSS)
    type: Boolean,
    default: true,
  },
  isRecurring: {
    // Whether the bonus is recurring (e.g., monthly) or one-time
    type: Boolean,
    default: false,
  },
  defaultAmount: {
    type: Number,
    default: 0,
  },
  calculationRule: {
    type: String,
    enum: ["fixed", "percentage", "manual"],
    default: "manual",
  },
  percentageOf: {
    type: String,
    enum: ["baseSalary", "grossSalary"],
  },
  active: {
    type: Boolean,
    default: true,
  },
});

export default mongoose.model("BonusType", bonusTypeSchema);
