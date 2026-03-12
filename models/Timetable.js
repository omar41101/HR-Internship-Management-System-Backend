import mongoose from "mongoose";

const timetableSchema = mongoose.Schema(
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
    type: {
      type: String,
      enum: ["Morning Shift", "Evening Shift", "Full-time Shift", "Day Off", "Special Shift"],
      required: true,
    },
    location: {
      type: String,
      enum: ["Remote", "Onsite"],
      required: true,
    },
    color: {
      type: String,
    },
    duration: {
      type: String,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    hasFeedback: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one shift per user per day
timetableSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("Timetable", timetableSchema);
