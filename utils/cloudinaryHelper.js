import cloudinary from "../config/cloudinary.js";

/**
 * Uploads an image to Cloudinary.
 * Handles both base64 strings and file buffers.
 * 
 * @param {string|Buffer} fileSource - The source of the file (base64 string or Buffer).
 * @param {string} folder - The destination folder in Cloudinary.
 * @returns {Promise<object>} - The upload result from Cloudinary.
 */
export const uploadToCloudinary = async (fileSource, folder = "hrcom/general") => {
    return new Promise((resolve, reject) => {
        const uploadOptions = {
            folder,
            resource_type: "image",
        };

        if (Buffer.isBuffer(fileSource)) {
            // Handle Buffer (mostly from multer)
            const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
            stream.end(fileSource);
        } else if (typeof fileSource === "string" && fileSource.startsWith("data:image")) {
            // Handle base64 string
            cloudinary.uploader.upload(fileSource, uploadOptions, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        } else {
            reject(new Error("Invalid file source. Expected Buffer or base64 string."));
        }
    });
};
