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
    verificationCode: {
      type: String,
    },
    verificationCodeExpires: {
      type: Date,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    resendCount: {  // Number of times the user has requested to resend the OTP code
      type: Number,
      default: 0,
    },
    resendDate: {  // Date of the last OTP code resend request to control: 3 resends per day
      type: Date,
      default: Date.now,
    },
    address: {
      type: String,
      required: true,
    },
    joinDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    position: {
      type: String,
      required: true,
    },
    bonus: {
      type: Number,
      min: 0,
    },
    profileImageURL: {
      type: String,
      default: "",
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
      default: true,
    },
    isAvailable: {
      // Availability to take more projects
      type: Boolean,
      default: true,
    },
    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserRole",
    },
    department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    supervisor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("User", userSchema);
