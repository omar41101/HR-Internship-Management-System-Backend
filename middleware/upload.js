import multer from "multer";

const storage = multer.memoryStorage();  // Store the file in memory not on the server

export const upload = multer({ storage });