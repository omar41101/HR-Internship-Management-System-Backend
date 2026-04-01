import mongoose from "mongoose";

const leaveTypeSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    isPaid: {
      // Represents whether the leave type is paid or unpaid
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("LeaveType", leaveTypeSchema);
