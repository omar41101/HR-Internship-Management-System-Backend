// Importations
import express from "express";
import dotenv from "dotenv";
import connectMongo from "./config/db.js";

import userRoutes from "./routes/userRoutes.js";
import UserRoleRoutes from "./routes/userRoleRoutes.js";

// Creation of an express app
const app = express(); 
dotenv.config();

app.use(express.json());

// Connect to MongoDB
connectMongo();

// Activate routes
app.use('/api', userRoutes);
app.use('/api', UserRoleRoutes);

// Define our PORT
const PORT = process.env.PORT || 3000;

// Start the express server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});