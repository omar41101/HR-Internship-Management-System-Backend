import cloudinary from "./config/cloudinary.js";
import dotenv from "dotenv";

dotenv.config();

function run() {
  const publicId = "hrcom/personal_docs/docs/table existing.pdf";
  const safePublicId = publicId.replace(/ /g, "%20");

  const viewUrl = cloudinary.url(safePublicId, {
    resource_type: "raw",
    flags: "inline",
    sign_url: true
  });

  console.log("Generated View URL:", viewUrl);
}

run();
