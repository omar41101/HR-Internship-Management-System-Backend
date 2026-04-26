import * as sprintService from "../services/sprintService.js";
import { errors as projectErrors } from "../errors/projectErrors.js";
import AppError from "../utils/AppError.js";

// Get all sprints of a project
export const getProjectSprints = async (req, res, next) => {
  try {
    // Build the query parameters
    const queryParams = {
      ...req.query,
      limit: 6,
      projectId: req.params.projectId,
      user: req.user,
    };

    const result = await sprintService.getAllSprintsOfProject(queryParams);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Get a sprint by Id
export const getSprintById = async (req, res, next) => {
  try {
    const result = await sprintService.getSprintById(req.params.id, req.user);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Create a new sprint
export const createSprint = async (req, res, next) => {
  try {
    const result = await sprintService.createSprint(req);
    res.status(result.code).json(result);
  }
  catch (err) {
    next(err);
  }
};

// Update a sprint
export const updateSprint = async (req, res, next) => {
  try {
    const result = await sprintService.updateSprint(
      req.params.sprintId,
      req.body,
      req.user
    );

    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Delete a sprint
export const deleteSprint = async (req, res, next) => {
  try {
    const result = await sprintService.deleteSprint(req.params.sprintId, req.user);
    res.status(result.code).json(result);
  }
  catch (err) {
    next(err);
  }
};

// Start a sprint
export const startSprint = async (req, res, next) => {
  try {
    const result = await sprintService.startSprint(req.params.sprintId, req.user);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }  
};

// Complete a sprint
export const completeSprint = async (req, res, next) => {
  try {
    const result = await sprintService.completeSprint(req.params.sprintId, req.user);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
