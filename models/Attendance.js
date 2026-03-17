import mongoose from "mongoose";

const attendanceSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    checkInTime: {
      type: String,
    },
    checkOutTime: {
      type: String,
    },
    status: {
      type: String,
      enum: ["present", "late", "absent", "leave"],
      default: "absent",
    },
    location: {
      type: String,
      enum: ["Remote", "Onsite"],
    },
    notes: {
      type: String,
    }
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one attendance record per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
