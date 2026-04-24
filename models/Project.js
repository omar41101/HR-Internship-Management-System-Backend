import mongoose from "mongoose";

const projectSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    sector: {
      type: String,
      enum: [
        "Finance",
        "Education",
        "Healthcare",
        "Agriculture",
        "Transportation",
        "Tourism",
      ],
      default: "Finance",
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Planning", "Active", "Completed", "On Hold", "Archived"],
      default: "Planning",
    },
    onHoldReason: {
      type: String,
      default: null,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    productOwnerId: {
      // The supervisor
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    scrumMasterId: {
      // Can be only an employee, not an intern
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    team_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Project", projectSchema);
