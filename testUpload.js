import fetch, { FormData, File } from "node-fetch";
import fs from "fs";

// Find user and token first
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import User from "./models/User.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({});
  if (!user) {
    console.log("No user found");
    process.exit(1);
  }

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const formData = new FormData();
  // Create a tiny dummy PDF
  const dummyBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
  const blob = new File([dummyBuffer], "dummy.pdf", { type: "application/pdf" });
  formData.append("personalDocument", blob);
  formData.append("title", "Test File");
  formData.append("isConfidential", "false");

  const res = await fetch(`http://localhost:3000/api/documents/personal-doc/${user._id}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  const body = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", body);
  process.exit(0);
}

run().catch(console.error);
