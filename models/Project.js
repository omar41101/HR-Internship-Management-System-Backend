import mongoose from "mongoose";

const projectSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "done", "at_risk"],
      default: "pending",
    },
    supervisor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    totalSubTasks: { type: Number, default: 0 },
    completedSubTasks: { type: Number, default: 0 },
    dueDate: { type: Date },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Project", projectSchema);
