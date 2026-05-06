import cron from "node-cron";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Payroll from "../models/Payroll.js";
import { calculatePayroll } from "../services/payrollService.js";
import AppError from "../utils/AppError.js";

// Runs every month on the 1st at 00:10 AM to generate draft payrolls for each employee
cron.schedule("10 0 1 * *", async () => {
  console.log("[CRON] Starting monthly payroll generation...");

  try {
    // Get previous month
    const now = new Date();
    const month = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1;
    const year =
      now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();

    // Fetch the Intern role
    const internRole = await UserRole.findOne({ name: "Intern" });

    // Fetch the active users (Exclude the Interns since they don't have payroll)
    const users = await User.find({
      status: "active",
      role_id: { $ne: internRole._id },
    });

    if (!users.length) {
      console.log("[CRON] No users found.");
      return;
    }

    for (const user of users) {
      try {
        // Prevent duplicate payrolls
        const existing = await Payroll.findOne({
          employeeId: user._id,
          month,
          year,
        });

        if (existing) {
          console.log(
            `[CRON] Payroll already exists for ${user.name} ${user.lastName}`,
          );
          continue;
        }

        // Compute payroll snapshot
        const computed = await calculatePayroll(
          user._id,
          month,
          year,
        );

        // Create payroll draft
        await Payroll.create({
          employeeId: user._id,
          month,
          year,
          ...computed,
          status: "draft",
          recalculationRequired: false,
        });

        console.log(`[CRON] Payroll created for ${user.name} ${user.lastName}`);
      } catch (err) {
        console.error(`[CRON] Error processing user ${user._id}:`, err.message);
      }
    }

    console.log("[CRON] Monthly payroll generation completed.");
  } catch (err) {
    console.error("[CRON] Fatal error:", err);
  }
});
