import Project from "../models/Project.js";
import Sprint from "../models/Sprint.js";
import TeamMember from "../models/TeamMember.js";
import Task from "../models/Task.js";
import AppError from "../utils/AppError.js";
import {
  uploadDocToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";
import { isProjectInactive } from "../utils/projectHelpers.js";

// ----------------------------------------------------------------------- //
// --------- HELPER FUNCTIONS FOR THE FILTERS IN THE FRONTEND ------------ //
// ----------------------------------------------------------------------- //

// Get all the statuses of a task
export const getAllTaskStatuses = async (req, res, next) => {
  try {
    const statuses = Task.schema.path("status").enumValues;

    res.status(200).json({
      status: "Success",
      statuses,
    });
  } catch (err) {
    next(err);
  }
};

// Get all the priorities of a task
export const getAllTaskPriorities = async (req, res, next) => {
  try {
    const priorities = Task.schema.path("priority").enumValues;

    res.status(200).json({
      status: "Success",
      priorities,
    });
  } catch (err) {
    next(err);
  }
};

// Get all the types of a task
export const getAllTaskTypes = async (req, res, next) => {
  try {
    const types = Task.schema.path("type").enumValues;

    res.status(200).json({
      status: "Success",
      types,
    });
  } catch (err) {
    next(err);
  }
};

// ----------------------------------------------------------------------- //
// --------------------------- TASK MANAGEMENT --------------------------- //
// ----------------------------------------------------------------------- //

// Get All tasks for a specific project (No Pagination)
export const getProjectTasks = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const { sprintId, hierarchy = "false", page = 1, type, status } = req.query;

    const limit = 10;
    const parsedPage = Math.max(parseInt(page), 1);
    const skip = (parsedPage - 1) * limit;

    // Check project existence
    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError("Project not found!", 404);
    }

    // Admin + Product owner of the project + Team members of the project can access the tasks of a project
    const { role, id: userId } = req.user; // Get the user info from the token

    // Authorization check
    if (role !== "Admin") {
      // Any Admin can access any project tasks
      if (role === "Supervisor") {
        // Check if the supervisor is the product owner of the project
        if (project.productOwnerId.toString() !== userId.toString()) {
          throw new AppError("Unauthorized to access the project tasks!", 403);
        }
      } else {
        // Check if the user is a team member of the project
        const membership = await TeamMember.findOne({
          userId,
          teamId: project.team_id,
        });

        if (!membership) {
          throw new AppError("Unauthorized to access the project tasks!", 403);
        }
      }
    }

    // Build the filter
    const filter = { projectId };

    // Filter by sprint (If NOT provided, then we return all the tasks (backlog + sprint tasks))
    if (sprintId) {
      // Check the sprint existance
      const sprint = await Sprint.findById(sprintId);
      if (!sprint) {
        throw new AppError("Sprint not found!", 404);
      }

      // Check if the sprint belongs to the project
      if (sprint.projectId.toString() !== projectId) {
        throw new AppError("Sprint does not belong to this project!", 400);
      }

      filter.sprintId = sprintId; // Only that sprint's tasks
    }

    // Filter by type (Story, Task, Sub-task, Bug)
    if (type) {
      const validTypes = Task.schema.path("type").enumValues;
      if (!validTypes.includes(type)) {
        throw new AppError("Invalid Task Type!", 400);
      }

      filter.type = type;
    }

    // Filter by status (Backlog, To Do, In Progress, Review, Done)
    if (status) {
      const validStatuses = Task.schema.path("status").enumValues;
      if (!validStatuses.includes(status)) {
        throw new AppError("Invalid Task Status!", 400);
      }

      filter.status = status;
    }

    // Prepare the project tasks (Flat list with no hierarchy)
    let query = Task.find(filter)
      .populate("assignedTo", "name lastName profileImageURL")
      .populate("sprintId", "number name goal status")
      .sort({ createdAt: -1 });

    // If hierarchy is True, we don't apply the pagination
    if (hierarchy !== "true") {
      query = query.skip(skip).limit(limit);
    }

    const tasks = await query;

    // Return a hierarchy of tasks (Stories with their sub-tasks)
    if (hierarchy === "true") {
      const taskMap = new Map();

      tasks.forEach((t) => {
        t = t.toObject();
        t.subTasks = [];
        taskMap.set(t._id.toString(), t);
      });

      const roots = [];

      tasks.forEach((t) => {
        const task = taskMap.get(t._id.toString());

        if (task.parentTaskId) {
          const parent = taskMap.get(task.parentTaskId.toString());
          if (parent) {
            parent.subTasks.push(task);
          }
        } else {
          roots.push(task);
        }
      });

      return res.status(200).json({
        status: "Success",
        tasks: roots,
      });
    }

    // Count the total number of tasks
    const totalTasks = await Task.countDocuments(filter);

    res.status(200).json({
      status: "Success",
      page: parsedPage,
      limit,
      totalPages: Math.ceil(totalTasks / limit),
      totalTasks,
      tasks,
    });
  } catch (err) {
    next(err);
  }
};

// Get task by Id
export const getTaskById = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    // Check task existence
    const task = await Task.findById(taskId)
      .populate("assignedTo", "name lastName profileImageURL")
      .populate("sprintId", "number name goal status");

    if (!task) {
      throw new AppError("Task not found!", 404);
    }

    // Check project existence
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError("Project not found!", 404);
    }

    // Access control: Admin + Product owner of the project + Team members of the project can access the task details
    const { role, id: userId } = req.user;

    if (role !== "Admin") {
      // Only the product owner of the project can access the task details
      if (role === "Supervisor") {
        if (project.productOwnerId.toString() !== userId.toString()) {
          throw new AppError("Unauthorized to access this task!", 403);
        }
      } else {
        // Only the team members of the project can access the task details
        const membership = await TeamMember.findOne({
          userId,
          teamId: project.team_id,
        });

        if (!membership) {
          throw new AppError("Unauthorized to access this task!", 403);
        }
      }
    }

    // Get the subtasks of the task (if there is any)
    const subTasks = await Task.find({ parentTaskId: task._id }).populate(
      "assignedTo",
      "name lastName profileImageURL",
    );

    res.status(200).json({
      status: "Success",
      task,
      subTasks,
    });
  } catch (err) {
    next(err);
  }
};

// Add a task to a specific project (Supervisor only)
export const addTask = async (req, res, next) => {
  try {
    const { id } = req.params; // Get the project ID to which the task will be added

    // Get the task details
    const {
      title,
      type = "Task",
      description,
      priority,
      storyPoints,
      parentTaskId,
      assignedTo,
      sprintId,
    } = req.body;

    // Check the project existence
    const project = await Project.findById(id);
    if (!project) {
      throw new AppError("Project not found!", 404);
    }

    // Check if the project is archived, completed or on hold
    if (isProjectInactive(project)) {
      throw new AppError(
        `Cannot add a task to a ${project.status.toLowerCase()} project!`,
        400,
      );
    }

    // Check the required fields
    if (!title) {
      throw new AppError("The Title is required!", 400);
    }

    // Check the story points validity
    if (
      storyPoints &&
      !Task.schema.path("storyPoints").enumValues.includes(storyPoints)
    ) {
      throw new AppError("Invalid Story Points!", 400);
    }

    // Check the priority validity
    if (
      priority &&
      !Task.schema.path("priority").enumValues.includes(priority)
    ) {
      throw new AppError("Invalid Priority!", 400);
    }

    // Check the type validity
    if (type && !Task.schema.path("type").enumValues.includes(type)) {
      throw new AppError("Invalid Task Type!", 400);
    }

    // Authorization Check: Only the product owner of the project can add a task
    const { role, id: userId } = req.user;

    if (project.productOwnerId.toString() !== userId.toString()) {
      throw new AppError("Unauthorized to add a task!", 403);
    }

    // The Sub-task validation: Must have a parent task
    if (type === "Sub-task") {
      if (!parentTaskId) {
        throw new AppError("Sub-task must have a parentTaskId!", 400);
      }

      // Check the parent task existence
      const parent = await Task.findById(parentTaskId);
      if (!parent) {
        throw new AppError("Parent task not found!", 404);
      }

      // Check if the parent task is not a sub-task (Only one level of sub-tasks is allowed)
      if (parent.parentTaskId) {
        throw new AppError("Cannot create sub-task of another sub-task!", 400);
      }

      // Check if the parent task belongs to the same project
      if (parent.projectId.toString() !== id) {
        throw new AppError("Parent task must belong to same project!", 400);
      }
    } else {
      if (parentTaskId) {
        throw new AppError("Only a sub-task can have a parent task!", 400);
      }
    }

    // Sprint validation and status assignment
    let validSprintId = null;
    let sprint = null;
    let status = "Backlog";

    if (sprintId) {
      // Check the sprint existence
      sprint = await Sprint.findById(sprintId);
      if (!sprint) {
        throw new AppError("Sprint not found!", 404);
      }

      // Check if the sprint belongs to the project
      if (sprint.projectId.toString() !== id) {
        throw new AppError("Sprint does not belong to this project!", 400);
      }

      // Check if the sprint is not completed
      if (sprint.status === "Completed") {
        throw new AppError("Cannot add task to a completed sprint!", 400);
      }

      validSprintId = sprintId;

      // Change the status to "To Do" if the task is added to an active sprint
      if (sprint.status === "Active") {
        status = "To Do";
      }
    }

    // User Assignment validation
    if (assignedTo) {
      // Check the user existence and if the user is a team member of the project
      const membership = await TeamMember.findOne({
        userId: assignedTo,
        teamId: project.team_id,
      });

      if (!membership) {
        throw new AppError(
          "Assigned user is not part of the project team!",
          400,
        );
      }
    }

    // Create task
    const task = await Task.create({
      title,
      description,
      status,
      priority,
      storyPoints,
      type,
      parentTaskId: parentTaskId || null,
      assignedTo: assignedTo || null,
      projectId: id,
      sprintId: validSprintId || null,
    });

    res.status(201).json({
      status: "Success",
      message: "Task created successfully!",
      task,
    });
  } catch (err) {
    next(err);
  }
};

// Update a task (Supervisor only)
export const updateTask = async (req, res, next) => {
  try {
    const { taskId } = req.params; // Get the task Id
    const updates = req.body;

    // Check the task existence
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError("Task not Found!", 404);
    }

    // Check the project existence
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError("Project not Found!", 404);
    }

    // Check if the project is archived, completed or on hold
    if (isProjectInactive(project)) {
      throw new AppError(
        `Cannot update a task of a ${project.status.toLowerCase()} project!`,
        400,
      );
    }

    // Check if the supervisor is the product owner of the project
    const { id: userId } = req.user;

    if (project.productOwnerId.toString() !== userId.toString()) {
      throw new AppError("Unauthorized to update a task!", 403);
    }

    // Validate if the type is changed to "Sub-task"
    if (updates.type === "Sub-task") {
      if (!updates.parentTaskId) {
        throw new AppError("Sub-task must have a parent!", 400);
      }

      // Check the parent task validity
      const parent = await Task.findById(updates.parentTaskId);
      if (!parent) {
        throw new AppError("Parent task not found!", 404);
      }

      if (parent.parentTaskId) {
        throw new AppError(
          "Cannot have a sub-task as a parent Task (Level 1 sub-tasks allowed)!",
          400,
        );
      }

      if (parent.projectId.toString() !== project._id.toString()) {
        throw new AppError("Parent must belong to same project!", 400);
      }
    } else if (updates.parentTaskId) {
      throw new AppError("Only a sub-task can have a parent task!", 400);
    }

    // Validate the Sprint logic
    let sprint = null;

    if (updates.sprintId !== undefined) {
      if (updates.sprintId === null) {
        // Move to Backlog status if removed from a sprint
        task.sprintId = null;
        task.status = "Backlog";
      } else {
        // Check the sprint existence
        sprint = await Sprint.findById(updates.sprintId);
        if (!sprint) {
          throw new AppError("Sprint not found!", 404);
        }

        // Check if the sprint belongs to the project
        if (sprint.projectId.toString() !== project._id.toString()) {
          throw new AppError("Sprint does not belong to the project!", 400);
        }

        // Check if the sprint is not completed
        if (sprint.status === "Completed") {
          throw new AppError("Cannot move a task to a completed sprint!", 400);
        }

        task.sprintId = updates.sprintId;

        if (sprint.status === "Active" && task.status === "Backlog") {
          task.status = "To Do";
        }
      }
    }

    // Validate the Status workflow rules
    if (updates.status) {
      const nextStatus = updates.status;

      // Check the new status validity
      if (!Task.schema.path("status").enumValues.includes(nextStatus)) {
        throw new AppError("Invalid Status!", 400);
      }

      task.status = nextStatus;

      if (nextStatus === "Done") {
        // Check if its sub tasks are done before marking the parent task as done
        const subTasks = await Task.find({ parentTaskId: task._id });
        if (subTasks.length === 0) {
          task.completedAt = new Date();
        } else {
          const incompleteSubTasks = subTasks.filter(
            (t) => t.status !== "Done",
          );
          if (incompleteSubTasks.length > 0) {
            throw new AppError(
              "Cannot mark a task as done while it has incomplete sub-tasks!",
              400,
            );
          }
          task.completedAt = new Date();
        }
      }
    }

    // Assignment of a task to a user validation
    if (updates.assignedTo) {
      // Check the user existence and if the user is a team member of the project
      const membership = await TeamMember.findOne({
        userId: updates.assignedTo,
        teamId: project.team_id,
      });

      if (!membership) {
        throw new AppError("User not in project team!", 400);
      }

      task.assignedTo = updates.assignedTo;
    }

    // Simple fields update (title, description, priority, story points, type)
    const simpleFields = [
      "title",
      "description",
      "priority",
      "storyPoints",
      "type",
    ];

    simpleFields.forEach((field) => {
      if (updates[field] !== undefined) {
        task[field] = updates[field];
      }
    });

    // Save the changes
    await task.save();

    res.status(200).json({
      status: "Success",
      message: "Task updated successfully!",
      task,
    });
  } catch (err) {
    next(err);
  }
};

// Delete a task
export const deleteTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    // Check the task existence
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError("Task not found!", 404);
    }

    // Check the project existence
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError("Project not found!", 404);
    }

    // Check if the project is archived, completed or on hold
    if (isProjectInactive(project)) {
      throw new AppError(
        `Cannot delete a task of a ${project.status.toLowerCase()} project!`,
        400,
      );
    }

    // Check if the supervisor that wants to delete the task is the product owner of the project
    const { id: userId } = req.user;

    if (project.productOwnerId.toString() !== userId.toString()) {
      throw new AppError("Unauthorized to delete task!", 403);
    }

    // STATUS RULE: You cannot delete a task that is In Progress or in Review
    const nonDeletableStatuses = ["In Progress", "Review"];
    if (nonDeletableStatuses.includes(task.status)) {
      throw new AppError(
        "Cannot delete a task that is In Progress or in Review!",
        400,
      );
    }

    // SUB-TASKS STATUS RULE: Check the sub-tasks status
    const invalidSubtask = await Task.exists({
      parentTaskId: taskId,
      status: { $in: ["In Progress", "Review"] },
    });

    if (invalidSubtask) {
      throw new AppError(
        "Cannot delete the Task: It has active sub-tasks!",
        400,
      );
    }

    // CASCADE DELETE
    await Task.deleteMany({ parentTaskId: taskId });
    await Task.findByIdAndDelete(taskId);

    res.status(200).json({
      status: "Success",
      message: "Task and Its sub-tasks deleted successfully!",
    });
  } catch (err) {
    next(err);
  }
};

// Move a task to a different status (Kanban logic)
export const moveTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    // Check the task existence
    const task = await Task.findById(taskId);
    if (!task) throw new AppError("Task not found!", 404);

    // Check the project existence
    const project = await Project.findById(task.projectId);
    if (!project) throw new AppError("Project not found!", 404);

    // Check if the project is archived, completed or on hold
    if (isProjectInactive(project)) {
      throw new AppError(
        `Cannot move a task of a ${project.status.toLowerCase()} project!`,
        400,
      );
    }

    // Check user authorization: Product owner of the project + Team members of the project can move a task
    const { id: userId } = req.user;
    const isOwner = project.productOwnerId.toString() === userId.toString();
    const isMember = await TeamMember.exists({
      userId,
      teamId: project.team_id,
    });

    if (!isOwner && !isMember) {
      throw new AppError("Unauthorized to move a task!", 403);
    }

    if (status) {
      const validStatuses = Task.schema.path("status").enumValues;
      if (!validStatuses.includes(status)) {
        throw new AppError("Invalid Status!", 400);
      }

      // Prevent a task from leaving backlog without being assigned to a sprint
      if (!task.sprintId && status !== "Backlog") {
        throw new AppError(
          "Task must be assigned to a sprint before leaving backlog!",
          400,
        );
      }

      task.status = status;

      task.completedAt = status === "Done" ? new Date() : null;
    }

    await task.save();

    res.status(200).json({
      status: "Success",
      message: "Task moved successfully!",
      task,
    });
  } catch (err) {
    next(err);
  }
};

// Submit a task (Only the assigned user)
export const submitTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { type, linkUrl, comment } = req.body;

    // Check the task existence
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError("Task not found!", 404);
    }

    // Check the project existence
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError("Project not found!", 404);
    }

    // Check if the project is archived, completed or on hold
    if (isProjectInactive(project)) {
      throw new AppError(
        `Cannot submit a task of a ${project.status.toLowerCase()} project!`,
        400,
      );
    }

    // Authorization check: Only the assigned user can submit
    const { id: userId } = req.user;
    if (!task.assignedTo || task.assignedTo.toString() !== userId.toString()) {
      throw new AppError("Unauthorized to submit this task!", 403);
    }

    // Status validation
    if (!["In Progress", "Review"].includes(task.status)) {
      throw new AppError(
        "Task must be in 'In Progress' or 'Review' to submit!",
        400,
      );
    }

    // Check the sprint state
    let sprintClosed = false;
    if (task.sprintId) {
      const sprint = await Sprint.findById(task.sprintId);

      if (sprint && sprint.status === "Completed") {
        sprintClosed = true;
      }
    }

    let finalUrl = "";
    let publicId = null;

    // CASE 1: FILE SUBMISSION
    if (type === "file") {
      if (!req.file) {
        throw new AppError("The Task File is required!", 400);
      }

      const result = await uploadDocToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "hrcom/task_submissions",
      );

      finalUrl = result.secure_url;
      publicId = result.public_id;
    }

    // CASE 2: LINK SUBMISSION
    else if (type === "link") {
      if (!linkUrl) {
        throw new AppError("The Task Link is required!", 400);
      }

      finalUrl = linkUrl;
    } else {
      throw new AppError("Invalid Submission Type!", 400);
    }

    // Detect the late submission
    const isLate = task.sprintId && sprintClosed;

    // Save submission
    task.submission = {
      type,
      linkUrl: finalUrl,
      linkPublicId: publicId,
      submittedAt: new Date(),
      submittedBy: userId,
      comment: comment || "",
    };

    // Move to Review automatically
    if (task.status === "In Progress") {
      task.status = "Review";
    }

    task.isSubmittedAfterSprintEnd = isLate;
    task.sprintClosedAtSubmission = sprintClosed;

    await task.save();

    res.status(200).json({
      status: "Success",
      message: "Task submitted successfully!",
      flags: {
        isLateSubmission: isLate,
        sprintAlreadyClosed: sprintClosed,
      },
      task,
    });
  } catch (err) {
    next(err);
  }
};

// Unsubmit a task (Only the assigned user)
export const unSubmitTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    // Check the task existence
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError("Task not found!", 404);
    }

    // Check the project existence
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError("Project not found!", 404);
    }

    // Check if the project is archived, completed or on hold
    if (isProjectInactive(project)) {
      throw new AppError(
        `Cannot unsubmit a task of a ${project.status.toLowerCase()} project!`,
        400,
      );
    }

    // Only the assigned user can remove his submission
    const { id: userId } = req.user;

    if (!task.assignedTo || task.assignedTo.toString() !== userId.toString()) {
      throw new AppError(
        "Only the assigned user can remove the task submission!",
        403,
      );
    }

    // Check if submission exists
    if (!task.submission || task.submission.type === "none") {
      throw new AppError("No submission to Delete!", 400);
    }

    // If it's a file, delete it from Cloudinary
    if (task.submission.type === "file" && task.submission.publicId) {
      await deleteFromCloudinary(task.submission.publicId, "raw");
    }

    // Clear the submission
    task.submission = {
      type: "none",
      linkUrl: "",
      publicId: null,
      submittedAt: null,
      submittedBy: null,
    };

    // Move back the task to "In Progress" (If it was in Review) automatically
    if (task.status === "Review") {
      task.status = "In Progress";
      task.completedAt = null;
    }

    await task.save();

    res.status(200).json({
      status: "Success",
      message: "Task submission removed successfully!",
      task,
    });
  } catch (err) {
    next(err);
  }
};

// Assign / Reassign Task (Supervisor only)
export const assignTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      throw new AppError(
        "The User you want to assign the task to is required!",
        400,
      );
    }

    // Check task existence
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError("Task not found!", 404);
    }

    // Check project existence
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError("Project not found!", 404);
    }

    // Check if the project is archived, completed or on hold
    if (isProjectInactive(project)) {
      throw new AppError(
        `Cannot assign a task of a ${project.status.toLowerCase()} project!`,
        400,
      );
    }

    // Check if the assigned user is in team
    const isMember = await TeamMember.findOne({
      userId: assignedTo,
      teamId: project.team_id,
    });
    if (!isMember) {
      throw new AppError("Assigned user is not part of the project team!", 400);
    }

    // Assign / Reassign the task
    const previousAssignee = task.assignedTo;
    task.assignedTo = assignedTo;
    await task.save();

    // If it's a parent task, we also update the assignedTo field of its sub-tasks
    let updatedSubTasks = [];
    if (!task.parentTaskId) {
      updatedSubTasks = await Task.updateMany(
        { parentTaskId: task._id },
        { assignedTo },
      );
    }

    res.status(200).json({
      status: "Success",
      message: previousAssignee
        ? "Task reassigned successfully!"
        : "Task assigned successfully!",
      task,
      updatedSubTasks,
    });
  } catch (err) {
    next(err);
  }
};

// Get My Tasks (Assigned to the logged in user)
export const getMyTasks = async (req, res, next) => {
  try {
    const userId = req.user.id; // Get the logged in user ID from the token

    const {
      page = 1,
      search,
      status,
      priority,
      type,
      projectId,
      sprintId,
    } = req.query;

    const limit = 10;
    const parsedPage = Math.max(parseInt(page), 1);
    const skip = (parsedPage - 1) * limit;

    // Build the filter
    const filter = {
      assignedTo: userId,
    };

    // Filter by Status (Backlog, To Do, In Progress, Review, Done)
    if (status) {
      const validStatuses = Task.schema.path("status").enumValues;
      if (!validStatuses.includes(status)) {
        throw new AppError("Invalid Task Status!", 400);
      }

      filter.status = status;
    }

    // Filter by Priority (Low, Medium, High)
    if (priority) {
      const validPriorities = Task.schema.path("priority").enumValues;
      if (!validPriorities.includes(priority)) {
        throw new AppError("Invalid Task Priority!", 400);
      }

      filter.priority = priority;
    }

    // Filter by Type (Story, Task, Sub-task, Bug)
    if (type) {
      const validTypes = Task.schema.path("type").enumValues;
      if (!validTypes.includes(type)) {
        throw new AppError("Invalid Task Type!", 400);
      }

      filter.type = type;
    }

    // Filter by Project ID
    if (projectId) {
      // Check the project existence
      const project = await Project.findById(projectId);
      if (!project) {
        throw new AppError("Project not found!", 404);
      }

      filter.projectId = projectId;
    }

    // Filter by Sprint ID
    if (sprintId) {
      // Check the sprint existence
      const sprint = await Sprint.findById(sprintId);
      if (!sprint) {
        throw new AppError("Sprint not found!", 404);
      }

      // If projectId is also provided, check if the sprint belongs to the project
      if (projectId && sprint.projectId.toString() !== projectId) {
        throw new AppError(
          "Sprint does not belong to the specified project!",
          400,
        );
      }

      filter.sprintId = sprintId;
    }

    // Search by the task title
    if (search) {
      filter.title = { $regex: search, $options: "i" };
    }

    // Fetch the paginated tasks
    const tasks = await Task.find(filter)
      .populate("projectId", "name status")
      .populate("sprintId", "number name status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Count the total tasks
    const totalTasks = await Task.countDocuments(filter);

    res.status(200).json({
      status: "Success",
      page: parsedPage,
      limit: limit,
      totalPages: Math.ceil(totalTasks / limit),
      totalTasks,
      tasks,
    });
  } catch (err) {
    next(err);
  }
};

// Review / Validate Task (Supervisor only - Product Owner of the project)
export const reviewTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { action, feedback } = req.body;

    if (!["approve", "reject"].includes(action)) {
      throw new AppError("Action must be 'approve' or 'reject'!", 400);
    }

    // Check task existence
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError("Task not found!", 404);
    }

    // Check the project existance
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError("Project not found!", 404);
    }

    // Check if the project is archived, completed or on hold
    if (isProjectInactive(project)) {
      throw new AppError(
        `Cannot review a task of a ${project.status.toLowerCase()} project!`,
        400,
      );
    }

    // Task must be in Review
    if (task.status !== "Review") {
      throw new AppError("Only tasks in 'Review' can be reviewed!", 400);
    }

    // Check if there is a submission to review
    if (!task.submission || task.submission.type === "none") {
      throw new AppError("There is no submission to review!", 400);
    }

    // Authorization check (Product owner only)
    const { id: userId } = req.user;
    if (project.productOwnerId.toString() !== userId.toString()) {
      throw new AppError("Unauthorized to review this task!", 403);
    }

    // Approve the task
    if (action === "approve") {
      task.status = "Done";
      task.completedAt = new Date();
    }

    // Reject the task
    if (action === "reject") {
      task.status = "In Progress";
      task.completedAt = null;
    }

    // Add feedback as a comment if provided
    if (feedback) {
      task.comments.push({
        text: feedback,
        author: userId,
        createdAt: new Date(),
      });
    }

    // Save the changes
    await task.save();

    res.status(200).json({
      status: "Success",
      message:
        action === "approve"
          ? "Task approved successfully!"
          : "Task rejected and sent back to In Progress!",
      task, 
    });
  } catch (err) {
    next(err);
  }
};
