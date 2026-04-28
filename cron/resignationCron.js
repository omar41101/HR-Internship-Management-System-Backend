import cron from "node-cron";
import Resignation from "../models/Resignation.js";
import User from "../models/User.js";

// Runs every day at midnight
cron.schedule("0 0 * * *", async () => {
  console.log("Running resignation cron job...");

  // Get the current date and time
  const now = new Date();

  try {
    // Move all approved resignations to scheduled_exit if their last working date has arrived
    const scheduled = await Resignation.updateMany(
      {
        status: "approved",
        lastWorkingDate: { $lte: now },
      },
      {
        status: "scheduled_exit",
      },
    );

    console.log(`Moved to scheduled_exit: ${scheduled.modifiedCount}`);

    // Move scheduled_exit → inactive + deactivate user if the last working date has passed
    const toDeactivate = await Resignation.find({
      status: "scheduled_exit",
      lastWorkingDate: { $lt: now },
    });

    for (const resignation of toDeactivate) {
      // Update resignation + save the changes
      resignation.status = "inactive";
      await resignation.save();

      // Deactivate the user automatically
      await User.findByIdAndUpdate(resignation.employeeId, {
        status: "Inactive",
      });
    }

    console.log(`Moved to inactive: ${toDeactivate.length}`);
  } catch (err) {
    console.error("Cron job error:", err);
  }
});
