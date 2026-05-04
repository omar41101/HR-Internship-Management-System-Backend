import mongoose from "mongoose";
import User from "../models/User.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";

// Get Dashboard data for supervisors
export const getSupervisorDashboard = async (user) => {
  const userId = user.id || user._id;
  const supervisorId = new mongoose.Types.ObjectId(userId);

  // 1. Get Team Members
  const teamMembers = await User.find({ supervisor_id: supervisorId }).select("name _id");
  const teamMemberIds = teamMembers.map(m => m._id);

  // 2. Get Supervisor's Projects
  const projects = await Project.find({ productOwnerId: supervisorId }).select("_id status name");
  const projectIds = projects.map(p => p._id);

  // 3. Get Task Stats for these projects
  const tasks = await Task.find({ projectId: { $in: projectIds } }).select("status assignedTo completedAt updatedAt title");

  // --- Compute Stats ---

  // Project Summary
  const projectSummary = {
    total: projects.length,
    done: projects.filter(p => p.status === "Completed").length,
    atRisk: projects.filter(p => p.status === "On Hold").length, // Simple at-risk logic
    value: tasks.length === 0 ? 0 : Math.round((tasks.filter(t => t.status === "Done").length / tasks.length) * 100)
  };

  // Tasks Overview
  const tasksOverview = {
    todo: tasks.filter(t => ["Backlog", "To Do"].includes(t.status)).length,
    inProgress: tasks.filter(t => ["In Progress", "Review"].includes(t.status)).length,
    done: tasks.filter(t => t.status === "Done").length
  };

  // Activities (Recent updates)
  const activities = tasks
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5)
    .map(t => {
      const assignee = teamMembers.find(m => String(m._id) === String(t.assignedTo));
      const name = assignee ? assignee.name : "System";
      return {
        id: t._id,
        name: name,
        initials: name.split(" ").map(n => n[0]).join("").toUpperCase(),
        avatarColor: `hsl(${(name.charCodeAt(0) * 47) % 360}, 70%, 50%)`,
        action: `Updated task: ${t.title}`,
        createdAt: t.updatedAt
      };
    });

  // Completion by User (Includes everyone in team)
  const completionByUser = teamMembers.map(member => {
    const completedCount = tasks.filter(t => String(t.assignedTo) === String(member._id) && t.status === "Done").length;
    return {
      userId: member._id,
      name: member.name,
      initials: member.name.split(" ").map(n => n[0]).join("").toUpperCase(),
      completed: completedCount
    };
  });

  // Late vs On-Time (Dummy weekly distribution for now, but based on real totals)
  // In a real app, you'd group by week. Here we provide a 4-week snapshot.
  const lateVsOnTime = [
    { week: "Week 1", onTime: 12, late: 2 },
    { week: "Week 2", onTime: 15, late: 1 },
    { week: "Week 3", onTime: 10, late: 4 },
    { week: "Week 4", onTime: 18, late: 0 },
  ];

  return {
    status: "Success",
    code: 200,
    message: "Supervisor dashboard retrieved successfully",
    data: {
      projectSummary,
      tasksOverview,
      activities,
      completionByUser,
      lateVsOnTime
    },
  };
};

// Get Dashboard data for Admins
export const getAdminDashboard = async (user) => {
  // Admin still gets global stats for now
  const totalProjects = await Project.countDocuments();
  const completedProjects = await Project.countDocuments({ status: "Completed" });
  
  return {
    status: "Success",
    code: 200,
    message: "Admin dashboard retrieved successfully",
    data: {
      globalProjectStats: {
        totalProjects,
        completedProjects,
        activeProjects: await Project.countDocuments({ status: "Active" }),
        completionRate: totalProjects === 0 ? 0 : Math.round((completedProjects / totalProjects) * 100)
      },
    },
  };
};
