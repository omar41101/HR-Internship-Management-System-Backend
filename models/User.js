import mongoose from "mongoose";
import { countries } from "../middleware/countries.js";

const userSchema = new mongoose.Schema(
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
    idType: {
      type: String,
      enum: ["CIN", "Passport"],
      required: true,
    },
    idNumber: {
      number: {
        type: String,
        required: true,
      },
      countryCode: {
        type: String,
        required: true,
        uppercase: true,
        minlength: 2,
        maxlength: 2,
        enum: countries.map((c) => c.code), // Must be a valid country code
      },
    },
    password: {
      type: String,
      required: true,
    },
    verificationCode: {
      // OTP code
      type: String,
    },
    verificationCodeExpires: {
      // OTP code expiration
      type: Date,
    },
    status: {
      // Account status
      type: String,
      enum: ["Pending", "Active", "Inactive", "Blocked"],
      default: "Pending",
    },
    resendCount: {
      // Number of times the user has requested to resend the OTP code
      type: Number,
      default: 0,
    },
    resendDate: {
      // Date of the last OTP resend request
      type: Date,
      default: Date.now,
    },
    mustResetPassword: {
      type: Boolean,
      default: true, // all new users must reset their password on first login
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    address: {
      type: String,
      required: true,
    },
    joinDate: {
      // UTC join date
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
    profileImagePublicId: {
      // Cloudinary public ID used for deletion
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
    faceDescriptors: {
      type: [[Number]],
      default: [],
    },
    faceEnrolled: {
      type: Boolean,
      default: false,
    },
    faceEnrollmentPromptRequired: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for the ID number uniqueness
userSchema.index(
  { "idNumber.number": 1, "idNumber.countryCode": 1 },
  { unique: true, sparse: true }
);

export default mongoose.model("User", userSchema);
