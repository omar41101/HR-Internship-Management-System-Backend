import mongoose from "mongoose";
<<<<<<< HEAD
=======
import { countries } from "../middleware/countries.js";
>>>>>>> sprint1

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
<<<<<<< HEAD
=======
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
        enum: countries.map((c) => c.code), // Ensure It's a valid country code from the list of countries
      },
    },
>>>>>>> sprint1
    password: {
      type: String,
      required: true,
    },
<<<<<<< HEAD
=======
    verificationCode: {
      // OTP Code
      type: String,
    },
    verificationCodeExpires: {
      // OTP Code expiration
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
      // Date of the last OTP code resend request to control: 3 resends per day
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
>>>>>>> sprint1
    address: {
      type: String,
      required: true,
    },
<<<<<<< HEAD
=======
    joinDate: {
      // UTC Join Date (No timezone issues)
      type: Date,
      required: true,
      default: Date.now,
    },
>>>>>>> sprint1
    phoneNumber: {
      type: String,
      required: true,
    },
<<<<<<< HEAD
=======
    position: {
      type: String,
      required: true,
    },
>>>>>>> sprint1
    bonus: {
      type: Number,
      min: 0,
    },
    profileImageURL: {
      type: String,
<<<<<<< HEAD
=======
      default: "",
    },
    profileImagePublicId: {
      // Cloudinary public ID of each profileimage used for deletion
      type: String,
      default: "",
>>>>>>> sprint1
    },
    bio: {
      type: String,
    },
    leaveBalance: {
      type: Number,
      default: 21,
    },
<<<<<<< HEAD
    faceData: {
      type: String,
      required: true,
    },
=======
>>>>>>> sprint1
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
<<<<<<< HEAD
    isActive: {
      type: Boolean,
      dafault: true,
    },
    isAvailable: {
      // Availability to take more projects
      type: Boolean,
      dafault: true,
=======
    isAvailable: {
      // Availability to take more projects
      type: Boolean,
      default: true,
>>>>>>> sprint1
    },
    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserRole",
    },
<<<<<<< HEAD
=======
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
>>>>>>> sprint1
  },
  {
    timestamps: true,
  },
);

<<<<<<< HEAD
=======
// Index for the ID number uniqueness
userSchema.index(
  { "idNumber.number": 1, "idNumber.countryCode": 1 },
  { unique: true, sparse: true }
);

>>>>>>> sprint1
export default mongoose.model("User", userSchema);
