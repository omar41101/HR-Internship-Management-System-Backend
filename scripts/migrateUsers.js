import mongoose from "mongoose";
import User from "../models/User.js";

import dotenv from "dotenv";
dotenv.config();

const migrateUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("🔄 Starting user migration...");

    const result = await User.updateMany(
      {
        $or: [
          { "employment.contractType": { $exists: false } },
          { salary: { $exists: false } },
        ],
      },
      {
        $set: {
          "employment.contractType": "CDI", // or "EMPLOYEE" fallback
          salary: {
            base: 0,
            currency: "DT",
          },
        },
      }
    );

    console.log("✅ Migration completed");
    console.log("📊 Modified users:", result.modifiedCount);

    process.exit();
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
};

migrateUsers();