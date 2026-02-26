import mongoose from "mongoose";

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    bonus: {
      type: Number,
      min: 0,
    },
    profileImageURL: {
      type: String,
    },
    bio: {
      type: String,
    },
    leaveBalance: {
      type: Number,
      default: 21,
    },
    faceData: {
      type: String,
      required: true,
    },
    socialStatus: {
      type: String,
      enum: ["Married", "Not Married"],
      default: "Not Married",
    },
    hasChildren: {
      type: Boolean,
      default: false,
    },
    nbOfChildren: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      dafault: true,
    },
    isAvailable: {
      // Availability to take more projects
      type: Boolean,
      dafault: true,
    },
    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserRole",
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("User", userSchema);
