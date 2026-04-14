import express from "express";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

router.get("/projects", authenticate, async (req, res) => {
  try {
    const projects = await Project.find()
      .populate("supervisor_id", "name lastName")
      .sort({ createdAt: -1 });

    const mapped = projects.map((project) => {
      const completed = project.completedSubTasks || 0;
      const total = project.totalSubTasks || 0;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        _id: project._id,
        id: String(project._id),
        name: project.name,
        description: project.description || "",
        status: project.status,
        supervisor:
          project.supervisor_id?.name && project.supervisor_id?.lastName
            ? `${project.supervisor_id.name} ${project.supervisor_id.lastName}`
            : project.supervisor_id?.name || "Unassigned",
        supervisor_id: project.supervisor_id?._id || null,
        createdAt: project.createdAt,
        dueDate: project.dueDate,
        totalSubTasks: total,
        completedSubTasks: completed,
        progress,
      };
    });

    return res.status(200).json({ status: "Success", projects: mapped });
  } catch (error) {
    return res.status(500).json({ status: "Error", message: error.message });
  }
});

router.get("/projects/:id/charts", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ status: "Error", message: "Project not found" });
    }

    const tasks = await Task.find({ projectId: id }).sort({ createdAt: 1 });
    const doneTasks = tasks.filter((task) => task.status === "done");

    const taskCompletionByStatus = [
      { status: "todo", label: "To Do", count: tasks.filter((task) => task.status === "todo").length },
      {
        status: "in_progress",
        label: "In Progress",
        count: tasks.filter((task) => task.status === "in_progress").length,
      },
      { status: "done", label: "Done", count: doneTasks.length },
    ];

    const velocityBucket = new Map();
    doneTasks.forEach((task) => {
      const dt = task.completedAt || task.updatedAt || task.createdAt;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      velocityBucket.set(key, (velocityBucket.get(key) || 0) + 1);
    });

    const velocityBySprint = Array.from(velocityBucket.entries()).map(([sprint, completed]) => ({
      sprint,
      completed,
    }));

    const result = {
      kpis: {
        totalSprints: 1,
        completedSprints: project.status === "done" ? 1 : 0,
        activeSprint: project.status === "in_progress" ? 1 : 0,
        totalTasks: tasks.length,
        doneTasks: doneTasks.length,
      },
      taskCompletionByStatus,
      velocityBySprint,
      activeSprintSnapshot: {
        name: "Current Sprint",
        goal: project.description || "No sprint goal provided",
        startDate: project.createdAt,
        endDate: project.dueDate || project.updatedAt,
        done: doneTasks.length,
        total: tasks.length,
        statusBreakdown: {
          todo: taskCompletionByStatus[0].count,
          in_progress: taskCompletionByStatus[1].count,
          done: taskCompletionByStatus[2].count,
        },
      },
    };

    return res.status(200).json({ status: "Success", result });
  } catch (error) {
    return res.status(500).json({ status: "Error", message: error.message });
  }
});

export default router;
