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
      enum: [
        "Morning Shift",
        "Evening Shift",
        "Day Off",
        "Special Shift",
      ],
      required: true,
    },
    startTime: {
      // Shift Start time in HH:mm format
      type: String,
      required: function () {
        return this.type !== "Day Off";
      },
    },
    endTime: {
      // Shift End time in HH:mm format
      type: String,
      required: function () {
        return this.type !== "Day Off";
      },
    },
    gracePeriod: {
      // Period in minutes for late arrivals
      type: Number,
      default: 15,
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
  },
  {
    timestamps: true,
  },
);

// Compound index to ensure multiple shifts per day but not the same shift type (This allows the 2 shifts for the full-time shift)
timetableSchema.index(
  { userId: 1, date: 1, type: 1 },
  { unique: true }
);

export default mongoose.model("Timetable", timetableSchema);
