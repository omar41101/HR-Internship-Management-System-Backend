import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Project from "./models/Project.js";
import Task from "./models/Task.js";
import Activity from "./models/Activity.js";
import { subDays, subWeeks } from "date-fns";

dotenv.config();

const seedDashboardData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for seeding...");

    // 1. Find or Create a Supervisor
    let supervisor = await User.findOne({ role: /supervisor/i });
    if (!supervisor) {
      console.warn("No supervisor found. Assigning first user as supervisor for testing...");
      supervisor = await User.findOne({});
      if (!supervisor) {
        console.error("No users found at all!");
        process.exit(1);
      }
      supervisor.role = "Supervisor";
      await supervisor.save();
    }
    console.log(`Seeding data for supervisor: ${supervisor.name} (${supervisor._id})`);

    // 2. Find Team Members
    const teamMembers = await User.find({ supervisor_id: supervisor._id });
    if (teamMembers.length === 0) {
      console.warn("No team members found for this supervisor. Finding any non-supervisor users to assign...");
      const others = await User.find({ _id: { $ne: supervisor._id }, role: { $not: /admin/i } }).limit(5);
      for (const u of others) {
        u.supervisor_id = supervisor._id;
        await u.save();
      }
      teamMembers.push(...others);
    }

    // 3. Create Projects
    await Project.deleteMany({ supervisor_id: supervisor._id });
    const projects = await Project.insertMany([
      { name: "Website Redesign", description: "Modernizing the corporate site", status: "in_progress", supervisor_id: supervisor._id, totalSubTasks: 10, completedSubTasks: 4, dueDate: subDays(new Date(), -10) },
      { name: "Mobile App API", description: "Backend for the new app", status: "done", supervisor_id: supervisor._id, totalSubTasks: 5, completedSubTasks: 5, dueDate: subDays(new Date(), 2) },
      { name: "Security Audit", description: "Quarterly security check", status: "at_risk", supervisor_id: supervisor._id, totalSubTasks: 8, completedSubTasks: 2, dueDate: subDays(new Date(), 5) },
    ]);

    // 4. Create Tasks
    await Task.deleteMany({ userId: { $in: teamMembers.map(m => m._id) } });
    const taskStatus = ["todo", "in_progress", "done"];
    
    for (const member of teamMembers) {
      // Create 5 tasks per member across different weeks
      for (let i = 0; i < 5; i++) {
        const status = taskStatus[Math.floor(Math.random() * taskStatus.length)];
        const dueDate = subDays(new Date(), (i - 2) * 7); // Spread across weeks
        const completedAt = status === "done" ? subDays(dueDate, Math.floor(Math.random() * 3) - 1) : null;

        await Task.create({
          name: `Task ${i+1} for ${member.name}`,
          status,
          userId: member._id,
          projectId: projects[i % projects.length]._id,
          dueDate,
          completedAt
        });
      }
    }

    // 5. Create Activities
    await Activity.deleteMany({ userId: { $in: teamMembers.map(m => m._id) } });
    for (const member of teamMembers) {
      await Activity.create({
        userId: member._id,
        action: `completed task "UI Component ${Math.floor(Math.random() * 10)}"`,
        type: "task",
        createdAt: subDays(new Date(), Math.random() * 2)
      });
    }

    console.log("Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedDashboardData();
