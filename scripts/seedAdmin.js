/**
 * Seed script: creates an "Admin" role and one admin user for testing.
 * Run from server folder: node scripts/seedAdmin.js
 *
 * Default test admin:
 *   Email:    admin@example.com
 *   Password: Admin123!
 *
 * Safe to run multiple times: skips creation if Admin role or admin user already exists.
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";

dotenv.config();

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "Admin123!";

async function seedAdmin() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/HR-DOTJCOM";
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected.\n");

  try {
    // 1. Create "Admin" role if it doesn't exist
    let adminRole = await UserRole.findOne({ name: "Admin" });
    if (!adminRole) {
      adminRole = await UserRole.create({
        name: "Admin",
        description: "Administrator with full access",
      });
      console.log('Created role: "Admin"');
    } else {
      console.log('Role "Admin" already exists');
    }

    // 2. Create admin user if none exists with Admin role
    const existingAdmin = await User.findOne({
      email: ADMIN_EMAIL.toLowerCase().trim(),
    });
    if (existingAdmin) {
      const existingRole = await UserRole.findById(existingAdmin.role_id);
      if (existingRole?.name === "Admin") {
        console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
        console.log("No changes made. Exiting.");
        process.exit(0);
        return;
      }
    }

    // If email exists but with another role, we don't overwrite; create with different email or ask user to delete
    if (existingAdmin) {
      console.log(
        `User ${ADMIN_EMAIL} already exists with another role. Delete that user first or use a different email in this script.`
      );
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await User.create({
      name: "Admin",
      lastName: "User",
      email: ADMIN_EMAIL.toLowerCase().trim(),
      password: hashedPassword,
      address: "Seed Address",
      joinDate: new Date(),
      phoneNumber: "+1234567890",
      position: "Administrator",
      status: "Active",
      role_id: adminRole._id,
      mustResetPassword: false, // so you can log in immediately for testing
    });
    console.log(`Created admin user: ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log("\nYou can log in with these credentials to test admin features.");
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
