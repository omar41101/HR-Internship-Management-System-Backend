// Imports
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";
import dotenv from "dotenv";
import connectMongo from "./config/db.js";
import "./cron/attendanceCron.js"; // To calculate the attendance stats automatically


// Creation of an express app
const app = express();

// Create HTTP server and attach Socket.io (mangage websocket connections)
const httpServer = createServer(app);

// Activate Socket.io with CORS Settings
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

import errorHandler from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import UserRoleRoutes from "./routes/userRoleRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import auditLogRoutes from "./routes/auditLogRoutes.js";
import timetableRoutes from "./routes/timetableRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import documentTypeRoutes from "./routes/documentTypeRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import specialShiftRoutes from "./routes/specialShiftRoutes.js";
import leaveTypeRoutes from "./routes/leaveTypeRoutes.js";

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Load the right .env file based on NODE_ENV
if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: ".env.test" });
} else {
  dotenv.config();
}

app.use(express.json({ limit: "10mb" })); // Handle JSON payloads (max size 10mb)
app.use(express.urlencoded({ limit: "10mb", extended: true })); // Parses data sent from HTML forms

// Swagger API Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Connect to MongoDB
connectMongo();

// Activate routes
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', UserRoleRoutes);
app.use('/api', departmentRoutes);
app.use('/api', auditLogRoutes);
app.use('/api', timetableRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', documentTypeRoutes);
app.use('/api', documentRoutes);
app.use('/api', testRoutes);
app.use('/api', specialShiftRoutes);
app.use('/api', leaveTypeRoutes);

// GLOBAL ERROR HANDLER
app.use(errorHandler);

// Define our PORT
const PORT = process.env.PORT || 3000;

// Export the app for the tests
export default app;

// Start the server only if not in test environment
if (process.env.NODE_ENV !== "test") {
  httpServer.listen(PORT, () => {
    console.log("==================================================");
    console.log(`=== SERVER STARTED AT: ${new Date().toISOString()} ===`);
    console.log(`=== LISTENING ON PORT: ${PORT}                ===`);
    console.log("==================================================");
  });
}
