import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Activity from "../models/Activity.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import { startOfMonth, endOfMonth, subWeeks, startOfISOWeek, endOfISOWeek } from "date-fns";

/**
 * Get aggregated dashboard statistics for a supervisor
 */
export const getSupervisorDashboardStats = async (req, res) => {
  try {
    const supervisorId = req.user._id;

    // 1. Identify Team Members
    const teamMembers = await User.find({ supervisor_id: supervisorId }).select("_id name profileImage");
    const teamMemberIds = teamMembers.map((m) => m._id);

    // 2. Project Summary
    const projects = await Project.find({ supervisor_id: supervisorId });
    const totalProjects = projects.length;
    const doneProjects = projects.filter((p) => p.status === "done").length;
    const atRiskProjects = projects.filter((p) => p.status === "at_risk").length;
    const projectValue = totalProjects > 0 ? Math.round((doneProjects / totalProjects) * 100) : 0;

    // 3. Tasks Overview (Donut Chart)
    const teamTasks = await Task.find({ userId: { $in: teamMemberIds } });
    const tasksOverview = {
      todo: teamTasks.filter((t) => t.status === "todo").length,
      inProgress: teamTasks.filter((t) => t.status === "in_progress").length,
      done: teamTasks.filter((t) => t.status === "done").length,
    };

    // 4. Team Activity (Feed & Timeline)
    const activitiesData = await Activity.find({ userId: { $in: teamMemberIds } })
      .populate("userId", "name profileImage")
      .sort({ createdAt: -1 })
      .limit(10);

    const activities = activitiesData.map((a) => {
      const name = a.userId?.name || "Unknown User";
      const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase();
      return {
        id: a._id,
        name,
        initials,
        avatarColor: "bg-blue-500", // Generic color or can be mapped from user
        action: a.action,
        createdAt: a.createdAt, // Frontend will format as relative time
      };
    });

    // 5. Tasks Completed per User (Bar Chart)
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    const completedTasksThisMonth = await Task.find({
      userId: { $in: teamMemberIds },
      status: "done",
      completedAt: { $gte: monthStart, $lte: monthEnd },
    });

    const completionByUser = teamMembers.map((user) => {
      const count = completedTasksThisMonth.filter((t) => t.userId.toString() === user._id.toString()).length;
      const initials = user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase();
      return {
        userId: user._id,
        name: user.name,
        initials,
        completed: count,
      };
    }).sort((a, b) => b.completed - a.completed);

    // 6. Late vs On-Time Tasks (4 Weeks Chart)
    const lateVsOnTime = [];
    const now = new Date();

    for (let i = 3; i >= 0; i--) {
      const weekDate = subWeeks(now, i);
      const start = startOfISOWeek(weekDate);
      const end = endOfISOWeek(weekDate);

      const weekTasks = await Task.find({
        userId: { $in: teamMemberIds },
        $or: [
          { completedAt: { $gte: start, $lte: end } },
          { dueDate: { $gte: start, $lte: end }, status: { $ne: "done" } },
        ],
      });

      let onTime = 0;
      let late = 0;

      weekTasks.forEach((t) => {
        if (t.status === "done") {
          if (t.completedAt <= t.dueDate) onTime++;
          else late++;
        } else {
          // If past due and not done
          if (t.dueDate < now) late++;
          else onTime++; // Assumption: if it's not due yet, it's on time
        }
      });

      lateVsOnTime.push({
        week: `Week ${4 - i}`,
        onTime,
        late,
      });
    }

    res.status(200).json({
      projectSummary: { total: totalProjects, done: doneProjects, atRisk: atRiskProjects, value: projectValue },
      tasksOverview,
      activities,
      completionByUser,
      lateVsOnTime,
    });
  } catch (error) {
    console.error("Dashboard calculation error:", error);
    res.status(500).json({ message: "Failed to calculate dashboard statistics" });
  }
};
