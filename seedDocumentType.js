/**
 * One-time seed script: inserts the "Personal" DocumentType if it doesn't exist.
 * Run with:  node seedDocumentType.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import DocumentType from "./models/DocumentType.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌  MONGO_URI not found in .env");
  process.exit(1);
}

await mongoose.connect(MONGO_URI);
console.log("✅  Connected to MongoDB");

const existing = await DocumentType.findOne({ name: "Personal" });

if (existing) {
  console.log("ℹ️   'Personal' document type already exists:", existing._id.toString());
} else {
  const doc = await DocumentType.create({
    name: "Personal",
    description: "Personal documents uploaded by users",
  });
  console.log("✅  Created 'Personal' document type with id:", doc._id.toString());
}

await mongoose.disconnect();
console.log("🔌  Disconnected from MongoDB");
