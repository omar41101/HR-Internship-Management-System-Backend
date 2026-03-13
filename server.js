// Importations
import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";
import dotenv from "dotenv";
import connectMongo from "./config/db.js";

import userRoutes from "./routes/userRoutes.js";
import UserRoleRoutes from "./routes/userRoleRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import auditLogRoutes from "./routes/auditLogRoutes.js";
import timetableRoutes from "./routes/timetableRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import errorHandler from "./middleware/errorHandler.js";
import documentTypeRoutes from "./routes/documentTypeRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";

// Creation of an express app
const app = express();

// Load the right .env file based on NODE_ENV
if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: ".env.test" });
}
else {
  dotenv.config();
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Swagger API Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Connect to MongoDB
connectMongo();

// Activate routes
app.use('/api', userRoutes);
app.use('/api', UserRoleRoutes);
app.use('/api', departmentRoutes);
app.use('/api', auditLogRoutes);
app.use('/api', timetableRoutes);
app.use('/api', testRoutes);
app.use('/api', documentTypeRoutes);
app.use('/api', documentRoutes);

// GLOBAL ERROR HANDLER
app.use(errorHandler);

// Define our PORT
const PORT = process.env.PORT || 3000;

// Export the app for the tests 
export default app;

// Start the server only if not in test environment
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log("==================================================");
    console.log(`=== SERVER STARTED AT: ${new Date().toISOString()} ===`);
    console.log(`=== LISTENING ON PORT: ${PORT}                ===`);
    console.log("==================================================");
  });
}