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
    startTime: {
      // Shift Start time in HH:mm format
      type: String,
      required: function () {
        // Start and end times are required for all shift types except "Day Off"
        return this.type !== "Day Off";
      },
      validate: {
        validator: function (v) {
          return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v); // Validates the HH:mm format
        },
        message: "The Start Time must be in HH:mm format",
      },
    },
    endTime: {
      // Shift End time in HH:mm format
      type: String,
      required: function () {
        return this.type !== "Day Off";
      },
      validate: {
        validator: function (v) {
          return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v); // Validates the HH:mm format
        },
        message: "The End Time must be in HH:mm format",
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
      required: function () {
        // Location is required for all shift types except "Day Off"
        return this.type !== "Day Off";
      },
    },
    color: {
      type: String,
    },
    specialShiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SpecialShift",
      default: null,
    },
    // Inline custom shift data (custom one-time, not saved to SpecialShift collection)
    specialShiftData: {
      type: new mongoose.Schema(
        {
          shiftType: { type: String, enum: ["single", "double"] },
          periods: [
            {
              startTime: { type: String },
              endTime: { type: String },
              _id: false,
            },
          ],
        },
        { _id: false }
      ),
      default: null,
    },
    specialShiftName: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure a single shift per day per user
timetableSchema.index({ userId: 1, date: 1}, { unique: true });

export default mongoose.model("Timetable", timetableSchema);
