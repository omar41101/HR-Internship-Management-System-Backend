// Main server setup for HRcoM API
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";
import dotenv from "dotenv";
import connectMongo from "./config/db.js";
import "./cron/attendanceCron.js"; // To calculate the attendance stats automatically

import errorHandler from "./middleware/errorHandler.js";
import authenticate from "./middleware/authenticate.js";
import authorize from "./middleware/authorize.js";
import swaggerAuth from "./middleware/swaggerAuth.js";

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
import dashboardRoutes from "./routes/dashboardRoutes.js";
import cors from "cors";


// Create Express app and HTTP server
const app = express();
const httpServer = createServer(app);

// Attach Socket.io
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Make io accessible from controllers via req.app.get("io")
app.set("io", io);

// Load the right .env file based on NODE_ENV
if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: ".env.test" });
} else {
  dotenv.config();
}

if (!process.env.FACE_ATTESTATION_SECRET) {
  console.warn(
    "[SECURITY-WARN] FACE_ATTESTATION_SECRET is not set. Biometric attendance check-in will be rejected."
  );
}

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cors({
  origin: "https://hr-internship-management-system.vercel.app",
  credentials: true // include this if you're using cookies/auth headers
}));

// Swagger API Documentation (env-controlled, basic auth in production)
const enableSwagger =
  process.env.ENABLE_SWAGGER === "true" || process.env.NODE_ENV !== "production";

if (enableSwagger) {
  if (process.env.NODE_ENV === "production") {
    // In production, protect Swagger UI with simple Basic Auth
    app.use(
      "/api-docs",
      swaggerAuth,
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec)
    );
  } else {
    // In non-production environments, expose Swagger UI without auth
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }
}

// Connect to MongoDB
connectMongo();

// Routes (v0 versioned + legacy /api for backward compatibility)
// Versioned base path
app.use("/api/v0", authRoutes);
app.use("/api/v0", userRoutes);
app.use("/api/v0", UserRoleRoutes);
app.use("/api/v0", departmentRoutes);
app.use("/api/v0", auditLogRoutes);
app.use("/api/v0", timetableRoutes);
app.use("/api/v0", attendanceRoutes);
app.use("/api/v0", documentTypeRoutes);
app.use("/api/v0", documentRoutes);
app.use("/api/v0", testRoutes);
app.use("/api/v0", specialShiftRoutes);
app.use("/api/v0", leaveTypeRoutes);
app.use("/api/v0/dashboard", dashboardRoutes);

// Legacy non-versioned base path (kept so existing clients keep working)
app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", UserRoleRoutes);
app.use("/api", departmentRoutes);
app.use("/api", auditLogRoutes);
app.use("/api", timetableRoutes);
app.use("/api", attendanceRoutes);
app.use("/api", documentTypeRoutes);
app.use("/api", documentRoutes);
app.use("/api", testRoutes);
app.use("/api", specialShiftRoutes);
app.use("/api", leaveTypeRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Global error handler
app.use(errorHandler);

// Define PORT
const PORT = process.env.PORT || 3000;

// Export the app for tests
export default app;

// Start the HTTP server (not in test environment)
if (process.env.NODE_ENV !== "test") {
  httpServer.listen(PORT, () => {
    console.log("==================================================");
    console.log(`=== SERVER STARTED AT: ${new Date().toISOString()} ===`);
    console.log(`=== LISTENING ON PORT: ${PORT}                ===`);
    console.log("==================================================");
  });
}
