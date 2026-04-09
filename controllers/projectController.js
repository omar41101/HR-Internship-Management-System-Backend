import mongoose from "mongoose";
import Project from "../models/Project.js";
import Sprint from "../models/Sprint.js";
import Task from "../models/Task.js";
import Team from "../models/Team.js";
import TeamMember from "../models/TeamMember.js";
import User from "../models/User.js";
import Document from "../models/Document.js";
import AppError from "../utils/AppError.js";
import { uploadDocToCloudinary, deleteFromCloudinary } from "../utils/cloudinaryHelper.js";

// Get all the sectors in a project
export const getAllSectors = async (req, res, next) => {
  try {
    const sectors = Project.schema.path("sector").enumValues;

    res.status(200).json({
      status: "Success",
      sectors,
    });
  } catch (err) {
    next(err);
  }
};

// Get all the statuses in a project (except "Archived")
export const getAllStatuses = async (req, res, next) => {
  try {
    const statuses = Project.schema
      .path("status")
      .enumValues.filter((s) => s !== "Archived");

    res.status(200).json({
      status: "Success",
      statuses,
    });
  } catch (err) {
    next(err);
  }
};

// Get all projects with pagination (12 per page) + optional : Search by project name + Filters
export const getAllProjects = async (req, res, next) => {
  try {
    const {
      page = 1,
      name,
      sector,
      status,
      supervisor,
      startDate,
      endDate,
      archived = false,
    } = req.query;

    const limit = 12;
    const parsedPage = Math.max(parseInt(page), 1);
    const skip = (parsedPage - 1) * limit;

    // Get the user info from the token
    const userId = req.user.id;
    const role = req.user.role;

    // Build our filter object
    const match = {};

    // The Admin can see all the projects, but the Supervisor/Employee/Intern can only see the projects they are involved in
    if (role !== "Admin") {
      if (role === "Supervisor") {
        // Supervisor can view the projects where they are the product owner
        match.productOwnerId = new mongoose.Types.ObjectId(userId);
      } else {
        // Employee/Intern can view the projects where they belong to the team
        const teams = await TeamMember.find({ userId }).select("teamId");
        const teamIds = teams.map((t) => t.teamId);
        match.team_id = {
          $in: teamIds.map((id) => new mongoose.Types.ObjectId(id)),
        };
      }
    }

    // See if we want to fetch the archived projects or the non-archived ones
    if (archived === "true") {
      match.status = "Archived";
    } else if (archived === "false") {
      match.status = { $ne: "Archived" };
    }

    // Optional search by project name
    if (name) match.name = { $regex: name, $options: "i" };

    // Optional filter by sector
    if (sector) match.sector = sector;

    // Optional filter by status
    if (status) match.status = status;

    // Optional filter by startDate / endDate
    if (startDate || endDate) match.startDate = {};

    if (startDate) match.startDate.$gte = new Date(startDate);
    if (endDate) match.startDate.$lte = new Date(endDate);

    // Optional filter by supervisor name
    if (supervisor) {
      const [firstName, ...rest] = supervisor.split(" ");
      const lastName = rest.join(" ");

      const user = await User.findOne({
        name: { $regex: `^${firstName}$`, $options: "i" },
        lastName: { $regex: `^${lastName}$`, $options: "i" },
      }).select("_id");

      if (user) {
        match.productOwnerId = { $in: [new mongoose.Types.ObjectId(user._id)] };
      }
    }

    // Aggregation pipeline
    const projects = await Project.aggregate([
      { $match: match },

      // Populate the team
      {
        $lookup: {
          from: "teams",
          localField: "team_id",
          foreignField: "_id",
          as: "team",
        },
      },
      { $unwind: { path: "$team", preserveNullAndEmptyArrays: true } },

      // Populate team members
      {
        $lookup: {
          from: "teammembers",
          localField: "team._id",
          foreignField: "teamId",
          as: "teamMembers",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "teamMembers.userId",
          foreignField: "_id",
          as: "teamMembersInfo",
        },
      },

      // Lookup for the current sprint
      {
        $lookup: {
          from: "sprints",
          let: { projectId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$projectId", "$$projectId"] },
                    { $eq: ["$status", "Active"] },
                  ],
                },
              },
            },
          ],
          as: "currentSprint",
        },
      },
      { $unwind: { path: "$currentSprint", preserveNullAndEmptyArrays: true } },

      // Count the total tasks for the current sprint
      {
        $lookup: {
          from: "tasks",
          let: { sprintId: "$currentSprint._id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$sprintId", "$$sprintId"] } } },
            { $count: "totalTasks" },
          ],
          as: "tasksCount",
        },
      },
      {
        $addFields: {
          totalTasks: {
            $ifNull: [{ $arrayElemAt: ["$tasksCount.totalTasks", 0] }, 0],
          },
        },
      },

      // Pagination
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    // Total count for pagination
    const totalProjects = await Project.countDocuments(match);

    res.status(200).json({
      status: "Success",
      page: parsedPage,
      limit,
      totalPages: Math.ceil(totalProjects / limit),
      totalProjects,
      projects,
    });
  } catch (err) {
    next(err);
  }
};

// Get project details by ID
export const getProjectById = async (req, res, next) => {
  try {
    const { id } = req.params; // Get the project ID
    const { role, id: userId } = req.user; // Get the user info from the token

    // Check the project existance
    const existingProject = await Project.findById(id);
    if (!existingProject) {
      throw new AppError("Project not found!", 404);
    }

    let match = { _id: new mongoose.Types.ObjectId(id) };

    // The Admin can access the details of all the projects, but the Supervisor/Employee/Intern can only access the projects they are involved in
    if (role === "Supervisor") {
      match.productOwnerId = new mongoose.Types.ObjectId(userId);
    } else if (role === "Employee" || role === "Intern") {
      const teams = await TeamMember.find({ userId }).select("teamId");
      const teamIds = teams.map((t) => t.teamId);
      if (!teamIds.length) {
        throw new AppError("Unauthorized to access the project!", 403);
      }
      match.team_id = {
        $in: teamIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    const project = await Project.aggregate([
      // Match the specific project
      { $match: match },

      // Populate the team
      {
        $lookup: {
          from: "teams",
          localField: "team_id",
          foreignField: "_id",
          as: "team",
        },
      },
      { $unwind: { path: "$team", preserveNullAndEmptyArrays: true } },

      // Populate team members
      {
        $lookup: {
          from: "teammembers",
          localField: "team._id",
          foreignField: "teamId",
          as: "teamMembers",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "teamMembers.userId",
          foreignField: "_id",
          as: "teamMembersInfo",
        },
      },

      // Populate all sprints
      {
        $lookup: {
          from: "sprints",
          localField: "_id",
          foreignField: "projectId",
          as: "sprints",
        },
      },

      // Populate all tasks
      {
        $lookup: {
          from: "tasks",
          localField: "_id",
          foreignField: "projectId",
          as: "tasks",
        },
      },

      // Populate all documents
      {
        $lookup: {
          from: "documents",
          localField: "_id",
          foreignField: "projectId",
          as: "documents",
        },
      },

      // Populate the product owner info
      {
        $lookup: {
          from: "users",
          localField: "productOwnerId",
          foreignField: "_id",
          as: "productOwnerInfo",
        },
      },
      {
        $unwind: {
          path: "$productOwnerInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
    ]);

    res.status(200).json({
      status: "Success",
      project: project,
    });
  } catch (err) {
    next(err);
  }
};

// Add a new project (Supervisor only)
export const createProject = async (req, res, next) => {
  // Prepare for manual rollback in case of any error during the creation process
  let project = null;
  let team = null;

  try {
    const {
      name,
      sector,
      description,
      status = "Planning",
      startDate,
      dueDate,
      scrumMasterId,
      teamMembers = [], // Team members except the scrum master
    } = req.body;

    // Get the product owner ID (supervisor) from the token
    const productOwnerId = req.user.id;

    // Check the required fields existence
    if (!name || !sector || !startDate || !dueDate) {
      throw new AppError("Missing the required fields!", 400);
    }

    // Check the project name uniqueness
    const existingProject = await Project.findOne({ name });
    if (existingProject) {
      throw new AppError("Project with this name already exists!", 400);
    }

    // Check the validity of the dates
    if (new Date(dueDate) < new Date(startDate)) {
      throw new AppError("Due date must be after start date!", 400);
    }

    // Validate the Scrum Master
    if (scrumMasterId) {
      const scrumMaster =
        await User.findById(scrumMasterId).populate("role_id");
      if (!scrumMaster) {
        throw new AppError("User not found!", 404);
      }

      // Ensure that the Scrum Master belongs to the supervisor's team
      if (scrumMaster.supervisor_id?.toString() !== productOwnerId.toString()) {
        throw new AppError(
          "You can only assign your own team members as Scrum Master!",
          403,
        );
      }

      // Check if the provided Scrum Master is not an Intern
      if (scrumMaster.role_id?.name === "Intern") {
        throw new AppError("An Intern cannot be a Scrum Master!", 400);
      }
    }

    // Create the project
    project = await Project.create({
      name,
      sector,
      status: status,
      description,
      startDate,
      dueDate,
      productOwnerId,
      scrumMasterId: scrumMasterId || null,
    });

    // Create the team
    team = await Team.create({
      name: `The ${name} Team`,
      projectId: project._id,
    });

    let createdMembers = [];

    // Combine Scrum Master + team members
    const membersToInsert = [
      ...(scrumMasterId
        ? [{ teamId: team._id, userId: scrumMasterId, role: "Scrum Master" }]
        : []),
      ...teamMembers.map((member) => ({
        teamId: team._id,
        userId: member.userId,
        role: member.role,
      })),
    ];

    // Create the Team Members (if provided)
    if (membersToInsert.length > 0) {
      // Extract all userIds
      const userIds = membersToInsert.map((m) => m.userId.toString());

      // Validate the users existance
      const users = await User.find({ _id: { $in: userIds } });
      if (users.length !== userIds.length) {
        throw new AppError("User(s) not found!", 404);
      }

      // Ensure that the supervisor can only add their own team members to the project
      const invalidUsers = users.filter(
        (u) => u.supervisor_id?.toString() !== productOwnerId.toString(),
      );

      if (invalidUsers.length > 0) {
        throw new AppError(
          "You can only add your own team members to the project!",
          403,
        );
      }

      // Prevent the user duplicates in a team
      const uniqueUserIds = new Set(userIds);
      if (uniqueUserIds.size !== userIds.length) {
        throw new AppError("Cannot add the same user twice in a team!", 400);
      }

      // Check that the scrum master is only included once in the team members list
      const scrumMastersInTeam = teamMembers.filter(
        (m) => m.role === "Scrum Master",
      );

      if (scrumMastersInTeam.length > 0) {
        throw new AppError(
          "Scrum Master should not be inside teamMembers list!",
          400,
        );
      }

      // Create the team members
      createdMembers = await TeamMember.insertMany(membersToInsert);
    }

    // Link the team to the project
    project.team_id = team._id;
    await project.save();

    res.status(201).json({
      status: "Success",
      message: "Project created successfully!",
      project,
      team,
      teamMembers: createdMembers,
    });
  } catch (err) {
    // Do the manual rollback
    try {
      if (team?._id) {
        await TeamMember.deleteMany({ teamId: team._id });
        await Team.findByIdAndDelete(team._id);
      }

      if (project?._id) {
        await Project.findByIdAndDelete(project._id);
      }
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }

    next(err);
  }
};

// Update a project (Supervisor only)
export const updateProject = async (req, res, next) => {
  try {
    const { id } = req.params; // Get the project ID from the URL
    const { role, id: userId } = req.user; // Get the user info from the token

    const {
      name,
      sector,
      description,
      status,
      onHoldReason,
      startDate,
      dueDate,
    } = req.body;

    // Check the project existence
    const project = await Project.findById(id);
    if (!project) {
      throw new AppError("Project not found!", 404);
    }

    // Control that only the supervisor of the project can update it (Not any supervisor)
    if (project.productOwnerId.toString() !== userId.toString()) {
      throw new AppError("Unauthorized to update this project!", 403);
    }

    // Input Validations

    // Check the name uniqueness (if updated)
    if (name && name !== project.name) {
      const existing = await Project.findOne({ name });
      if (existing) {
        throw new AppError("Project with this name already exists!", 400);
      }
      project.name = name;
    }

    // Check the sector value (if updated)
    if (sector) {
      const allowedSectors = await getAllSectors().sectors;
      if (!allowedSectors.includes(sector)) {
        throw new AppError("Invalid sector value!", 400);
      }
      project.sector = sector;
    }

    // Check the description (if updated)
    if (description !== undefined) {
      project.description = description;
    }

    // Dates validation
    const newStartDate = startDate ? new Date(startDate) : project.startDate;
    const newDueDate = dueDate ? new Date(dueDate) : project.dueDate;

    if (newDueDate && newStartDate && newDueDate < newStartDate) {
      throw new AppError("Due date must be after start date!", 400);
    }

    if (startDate) project.startDate = newStartDate;
    if (dueDate) project.dueDate = newDueDate;

    // Status + onHoldReason logic
    if (status) {
      const allowedStatuses = Project.schema.path("status").enumValues;

      if (!allowedStatuses.includes(status)) {
        throw new AppError("Invalid status value!", 400);
      }

      project.status = status;

      // If project is On Hold, attach the hold reason if it exists
      if (status === "On Hold" && onHoldReason) {
        project.onHoldReason = onHoldReason;
      } else if (status !== "On Hold" && onHoldReason) {
        throw new AppError(
          "Hold reason can only be provided if the project is On Hold!",
          400,
        );
      }

      // If the status = Active, we check if we have a scrum master and at least 1 team member
      if (status === "Active") {
        // Get the project's team
        const team = await Team.findById(project.team_id);
        if (!team) {
          throw new AppError("Team not found for the project!", 404);
        }

        // Count the team members in the team
        const teamMembersCount = await TeamMember.countDocuments({
          teamId: team._id,
        });

        if (!project.scrumMasterId) {
          throw new AppError(
            "Cannot set a project to Active without a Scrum Master!",
            400,
          );
        }

        if (teamMembersCount === 0) {
          throw new AppError(
            "Cannot set a project to Active without at least 1 team member!",
            400,
          );
        }
      }
    }

    // Save the changes
    await project.save();

    res.status(200).json({
      status: "Success",
      message: "Project updated successfully!",
      project,
    });
  } catch (err) {
    next(err);
  }
};

// Archive a project (Supervisor Only)
export const archiveProject = async (req, res, next) => {
  try {
    const { id } = req.params; // Get the project ID from the URL
    const { role, id: userId } = req.user; // Get the user info from the token

    // Check the project existence
    const project = await Project.findById(id);
    if (!project) {
      throw new AppError("Project not found!", 404);
    }

    // Access control (only the supervisor of the project can archive it, not any supervisor)
    if (project.productOwnerId.toString() !== userId.toString()) {
      throw new AppError("Unauthorized to archive this project!", 403);
    }

    // Prevent the double archive
    if (project.status === "Archived") {
      throw new AppError("Project is already archived!", 400);
    }

    // Archive the project
    project.status = "Archived";
    project.onHoldReason = null;

    await project.save();

    res.status(200).json({
      status: "Success",
      message: "Project archived successfully!",
      project,
    });
  } catch (err) {
    next(err);
  }
};

// Restore a Project (Supervisor Only)
export const restoreProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    // Check project existence
    const project = await Project.findById(id);
    if (!project) {
      throw new AppError("Project not found!", 404);
    }

    // 🔐 Access control
    if (project.productOwnerId.toString() !== userId.toString()) {
      throw new AppError("Unauthorized to restore this project!", 403);
    }

    // Only archived projects can be restored
    if (project.status !== "Archived") {
      throw new AppError("Only archived projects can be restored!", 400);
    }

    // Restore project
    project.status = "Planning";
    await project.save();

    res.status(200).json({
      status: "Success",
      message: "Project restored successfully!",
      project,
    });
  } catch (err) {
    next(err);
  }
};

// Delete a project (Admin only)
export const deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check project existence
    const project = await Project.findById(id);
    if (!project) {
      throw new AppError("Project not found!", 404);
    }

    // Make sure that the project is archived
    if (project.status !== "Archived") {
      throw new AppError(
        "Project must be archived before deletion!",
        400
      );
    }

    // DELETE EVERYTHING RELATED TO THE PROJECT (Team, Team Members, Tasks, Sprints, Documents)

    // Delete team members
    await TeamMember.deleteMany({ teamId: project.team_id });

    // Delete team
    await Team.findByIdAndDelete(project.team_id);

    // Delete tasks
    await Task.deleteMany({ projectId: project._id });

    // Delete sprints
    await Sprint.deleteMany({ projectId: project._id });

    // Delete documents related to the project
    const docs = await Document.find({ projectId: project._id });

    // Delete the documents from Cloudinary
    for (const doc of docs) {
      await deleteFromCloudinary(doc.filePublicId, "raw");
    }
    await Document.deleteMany({ projectId: project._id });

    // Delete the project
    await Project.findByIdAndDelete(project._id);

    res.status(200).json({
      status: "Success",
      message: "Project deleted successfully!",
    });
  } catch (err) {
    next(err);
  }
};

