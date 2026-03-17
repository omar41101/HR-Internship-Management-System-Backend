import mongoose from "mongoose";
import Document from "./models/Document.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const docs = await Document.find().sort({createdAt:-1}).limit(2);
  console.log(JSON.stringify(docs, null, 2));
  process.exit(0);
}

run().catch(console.error);
