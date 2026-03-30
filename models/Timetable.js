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
        "Full-time Shift",
        "Day Off",
        "Special Shift",
      ],
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
    /*
     * WHAT: Special Shift extensions (optional fields)
     * WHY: Three-layer shift system:
     *   1. Standard shifts → no extra fields needed
     *   2. Reusable Special Shift → specialShiftId references SpecialShift collection
     *   3. Custom one-time Special Shift → specialShiftData stored inline, no DB ref
     * These fields are null/undefined for all non-special-shift entries.
     */
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
    // Denormalized name for fast calendar rendering without extra populate
    // Set from specialShift.name (reusable) or "Custom" label (inline)
    specialShiftName: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one shift per user per day
timetableSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("Timetable", timetableSchema);
