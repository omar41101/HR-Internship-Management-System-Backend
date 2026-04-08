import mongoose from "mongoose";

const taskSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Backlog", "To Do", "In Progress", "Review", "Done"],
      default: "Backlog",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    storyPoints: {
      type: Number,
      enum: [1, 2, 3, 5, 8, 13],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    sprintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      default: null, // In this case, the task is in the backlog and not yet assigned to a sprint
    },
    dueDate: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    submission: {
      type: {
        type: String,
        enum: ["none", "file", "link"],
        default: "none",
      },
      fileUrl: { 
        // Cloudinary URL for the submitted file (if submission type is "file")
        type: String,
        default: "",
      },
      link: {
        // URL for the submitted link (if submission type is "link")
        type: String,
        default: "",
      },
      submittedAt: {
        type: Date,
      },
      submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Task", taskSchema);
