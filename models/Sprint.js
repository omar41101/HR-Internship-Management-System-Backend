import mongoose from "mongoose";

const sprintSchema = mongoose.Schema(
  {
    number: {
      type: Number, // Sprint number within the project
      required: true,
    },
    goal: {
      type: String, // Sprint goal
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Planned", "Active", "Completed"],
      default: "Planned",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Sprint", sprintSchema);
