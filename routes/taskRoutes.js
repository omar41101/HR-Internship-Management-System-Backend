import express from "express";
import Task from "../models/Task.js";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

router.get("/tasks", authenticate, async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const { userId } = req.query;

    let filter = {};
    if (role === "hr" || role === "admin" || role === "supervisor") {
      if (userId) filter = { userId };
    } else {
      filter = { userId: req.user?._id };
    }

    const tasks = await Task.find(filter)
      .populate("projectId", "name")
      .sort({ dueDate: 1, createdAt: -1 });

    const mapped = tasks.map((task) => ({
      _id: task._id,
      id: String(task._id),
      title: task.name,
      description: task.description || "",
      status: task.status === "todo" ? "pending" : task.status,
      priority: "medium",
      dueDate: task.dueDate,
      deadline: task.dueDate,
      projectName: task.projectId?.name || "Internal Project",
      project: task.projectId?.name || "Internal Project",
    }));

    return res.status(200).json({ status: "Success", tasks: mapped });
  } catch (error) {
    return res.status(500).json({ status: "Error", message: error.message });
  }
});

router.patch("/tasks/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatus = ["todo", "in_progress", "done", "pending", "submitted", "approved"];
    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({ status: "Error", message: "Invalid task status" });
    }

    const normalizedStatus =
      status === "pending" ? "todo" : status === "submitted" || status === "approved" ? "done" : status;

    const update = {};
    if (normalizedStatus) update.status = normalizedStatus;
    if (normalizedStatus === "done") update.completedAt = new Date();

    const task = await Task.findByIdAndUpdate(id, update, { new: true });
    if (!task) {
      return res.status(404).json({ status: "Error", message: "Task not found" });
    }

    return res.status(200).json({ status: "Success", result: task });
  } catch (error) {
    return res.status(500).json({ status: "Error", message: error.message });
  }
});

export default router;
