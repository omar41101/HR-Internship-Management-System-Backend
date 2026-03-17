import fetch from "node-fetch";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import User from "./models/User.js";
import Document from "./models/Document.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({});
  const doc = await Document.findOne({ user_id: user._id }).sort({ createdAt: -1 });
  
  if (!doc) {
    console.log("No document found to test.");
    process.exit(1);
  }

  console.log("Found document:", doc.title, doc.fileURL);

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Test Download Route
  console.log("\n--- Testing Download Route ---");
  const downloadUrl = `http://localhost:3000/api/documents/personal-doc/download/${doc._id}`;
  const downloadRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "manual" // We want to see the redirect
  });

  console.log("Download Status:", downloadRes.status);
  console.log("Download Headers:", downloadRes.headers.raw());
  if (downloadRes.status !== 302) {
    console.log("Download Body:", await downloadRes.text());
  } else {
    const redirectUrl = downloadRes.headers.get("location");
    console.log("Redirects to:", redirectUrl);
    
    // Follow the redirect
    console.log("Following redirect...");
    const cloudinaryRes = await fetch(redirectUrl);
    console.log("Cloudinary Status:", cloudinaryRes.status);
    console.log("Cloudinary Headers:", cloudinaryRes.headers.raw());
    if (cloudinaryRes.status >= 400) {
      console.log("Cloudinary Error Body:", await cloudinaryRes.text());
    }
  }

  // Test Consult Route
  console.log("\n--- Testing Consult Route ---");
  const consultUrl = `http://localhost:3000/api/documents/personal-doc/consult/${doc._id}`;
  const consultRes = await fetch(consultUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log("Consult Status:", consultRes.status);
  const consultJson = await consultRes.json();
  console.log("Consult JSON:", consultJson);

  if (consultJson.url) {
    console.log("Testing Consult Cloudinary URL...");
    const cloudConsultRes = await fetch(consultJson.url);
    console.log("Cloudinary Consult Status:", cloudConsultRes.status);
    if (cloudConsultRes.status >= 400) {
        console.log("Cloudinary Consult Error Body:", await cloudConsultRes.text());
    }
  }

  process.exit(0);
}

run().catch(console.error);
