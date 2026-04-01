import mongoose from "mongoose";

const leaveTypeSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
    },
    isPaid: {
      // Represents whether the leave type is paid or unpaid
      type: Boolean,
      default: true,
    },
    status: {
      // For the Archive/Restore functionality
      type: String,
      enum: ["Active", "Archived"],
      default: "Active"
    }
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("LeaveType", leaveTypeSchema);
