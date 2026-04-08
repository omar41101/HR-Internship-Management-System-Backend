import mongoose from "mongoose";

const teamMemberSchema = mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: [
        "Scrum Master",
        "Frontend Developer",
        "Backend Developer",
        "Fullstack Developer",
        "QA Engineer",
        "UI/UX Designer",
        "DevOps Engineer",
        "Mobile Developer",
        "AI Engineer",
        "BI Specialist",
      ],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Ensure that a user can only be added to a team once
teamMemberSchema.index({ teamId: 1, userId: 1 }, { unique: true });

export default mongoose.model("TeamMember", teamMemberSchema);
