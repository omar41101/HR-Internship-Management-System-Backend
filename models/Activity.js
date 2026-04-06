import mongoose from "mongoose";

const activitySchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String, // e.g. "completed task Deploy API", "was marked absent"
      required: true,
    },
    type: {
      type: String,
      enum: ["task", "attendance", "comment", "leave"],
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export default mongoose.model("Activity", activitySchema);
