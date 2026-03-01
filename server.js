// Importations
import express from "express";
import dotenv from "dotenv";
import connectMongo from "./config/db.js";

import userRoutes from "./routes/userRoutes.js";
import UserRoleRoutes from "./routes/userRoleRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";

// Creation of an express app
const app = express(); 

// Load the right .env file based on NODE_ENV
if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: ".env.test" });
} 
else {
  dotenv.config();
}

app.use(express.json());

// Connect to MongoDB
connectMongo();

// Activate routes
app.use('/api', userRoutes);
app.use('/api', UserRoleRoutes);
app.use('/api', departmentRoutes);

// Define our PORT
const PORT = process.env.PORT || 3000;

// Export the app for the tests 
export default app;

// Start the server only if not in test environment
if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}