import Document from "../models/Document.js";
import DocumentRequest from "../models/DocumentRequest.js";
import Project from "../models/Project.js";
import Sprint from "../models/Sprint.js";
import Task from "../models/Task.js";
import Team from "../models/Team.js";
import TeamMember from "../models/TeamMember.js";
import crypto from "crypto";
import { errors } from "../errors/documentRequestErrors.js";
import { errors as projectErrors } from "../errors/projectErrors.js";
import { errors as documentTypeErrors } from "../errors/documentTypeErrors.js";
import AppError from "../utils/AppError.js";
import { getOne, getAll } from "./handlersFactory.js";
import { validateDocumentRequestScope } from "../utils/documentRequestHelpers.js";

// Add a new document request
export const createDocumentRequest = async (data, currentUser) => {
  const { title, description, projectId, scope, sprintId, taskId, dueDate } =
    data;

  // Check the project existence
  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Check the team existence for the project
  const team = await Team.findOne({ projectId });
  if (!team) {
    throw new AppError(
      projectErrors.TEAM_NOT_FOUND.message,
      projectErrors.TEAM_NOT_FOUND.code,
      projectErrors.TEAM_NOT_FOUND.errorCode,
      projectErrors.TEAM_NOT_FOUND.suggestion,
    );
  }

  // Check if the user is a member of the project
  const isMember = await TeamMember.exists({
    teamId: team._id,
    userId: currentUser.id,
  });
  if (!isMember) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_ADD_DOCUMENT_REQUEST.message,
      errors.UNAUTHORIZED_TO_ADD_DOCUMENT_REQUEST.code,
      errors.UNAUTHORIZED_TO_ADD_DOCUMENT_REQUEST.errorCode,
      errors.UNAUTHORIZED_TO_ADD_DOCUMENT_REQUEST.suggestion,
    );
  }

  // Validate the scope logic
  await validateDocumentRequestScope(scope, sprintId, taskId, projectId);

  // Create the document request
  const request = await DocumentRequest.create({
    title,
    description,
    projectId,
    scope,
    sprintId,
    taskId,
    dueDate,
    requestedBy: currentUser.id,
  });

  return {
    status: "Success",
    code: 201,
    message: "Document request created successfully!",
    data: request,
  };
};

// Get all document requests for a project
export const getAllDocumentRequests = async (projectId, queryParams, user) => {
  // Check the project existence
  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Access control: Only Admin + project members can view document requests
  const isAdmin = user.role === "Admin";

  const team = await Team.findOne({ projectId });
  if (!team) {
    throw new AppError(
      projectErrors.TEAM_NOT_FOUND.message,
      projectErrors.TEAM_NOT_FOUND.code,
      projectErrors.TEAM_NOT_FOUND.errorCode,
      projectErrors.TEAM_NOT_FOUND.suggestion,
    );
  }

  const isMember = await TeamMember.exists({
    teamId: team._id,
    userId: user.id,
  });

  const isProductOwner =
    project.productOwnerId.toString() === user.id.toString();

  if (!isMember && !isProductOwner && !isAdmin) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_VIEW_DOCUMENT_REQUESTS.message,
      errors.UNAUTHORIZED_TO_VIEW_DOCUMENT_REQUESTS.code,
      errors.UNAUTHORIZED_TO_VIEW_DOCUMENT_REQUESTS.errorCode,
      errors.UNAUTHORIZED_TO_VIEW_DOCUMENT_REQUESTS.suggestion,
    );
  }

  // Filter by project (To view only document requests related to the project)
  const filters = {
    ...queryParams,
    projectId,
  };

  return await getAll(
    DocumentRequest,
    [
      { path: "requestedBy", select: "name email" },
      { path: "sprintId", select: "name number" },
      { path: "taskId", select: "title status" },
      { path: "fulfilledDocumentId", select: "title fileURL" },
    ],
    null,
    ["title", "description"],
  )(filters);
};

// Get a document request by ID
export const getDocumentRequestById = async (requestId, user) => {
  // Check the document request existence
  const request = await DocumentRequest.findById(requestId);
  if (!request) {
    throw new AppError(
      errors.DOCUMENT_REQUEST_NOT_FOUND.message,
      errors.DOCUMENT_REQUEST_NOT_FOUND.code,
      errors.DOCUMENT_REQUEST_NOT_FOUND.errorCode,
      errors.DOCUMENT_REQUEST_NOT_FOUND.suggestion,
    );
  }

  // Check the project existence
  const project = await Project.findById(request.projectId);
  if (!project) {
    throw new AppError(
      projectErrors.PROJECT_NOT_FOUND.message,
      projectErrors.PROJECT_NOT_FOUND.code,
      projectErrors.PROJECT_NOT_FOUND.errorCode,
      projectErrors.PROJECT_NOT_FOUND.suggestion,
    );
  }

  // Access control: Only Admin + project members can view document requests
  const isAdmin = user.role === "Admin";
  const team = await Team.findOne({ projectId: project._id });
  const isMember = await TeamMember.exists({
    teamId: team._id,
    userId: user.id,
  });

  const isProductOwner =
    project.productOwnerId.toString() === user.id.toString();

  if (!isMember && !isProductOwner && !isAdmin) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_VIEW_DOCUMENT_REQUESTS.message,
      errors.UNAUTHORIZED_TO_VIEW_DOCUMENT_REQUESTS.code,
      errors.UNAUTHORIZED_TO_VIEW_DOCUMENT_REQUESTS.errorCode,
      errors.UNAUTHORIZED_TO_VIEW_DOCUMENT_REQUESTS.suggestion,
    );
  }

  return await getOne(DocumentRequest, errors.DOCUMENT_REQUEST_NOT_FOUND, [
    { path: "requestedBy", select: "name email" },
    { path: "sprintId", select: "name number" },
    { path: "taskId", select: "title status" },
    { path: "fulfilledDocumentId", select: "title fileURL" },
  ])(requestId);
};

// Edit a document request (Only the creator of the request can edit the request)
export const editDocumentRequest = async (requestId, data, user) => {
  // Check the document request existence
  const request = await DocumentRequest.findById(requestId);
  if (!request) {
    throw new AppError(
      errors.DOCUMENT_REQUEST_NOT_FOUND.message,
      errors.DOCUMENT_REQUEST_NOT_FOUND.code,
      errors.DOCUMENT_REQUEST_NOT_FOUND.errorCode,
      errors.DOCUMENT_REQUEST_NOT_FOUND.suggestion,
    );
  }

  // Access control: Only the creator of the document request can edit it
  if (request.requestedBy.toString() !== user.id.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_UPDATE_DOCUMENT_REQUEST.message,
      errors.UNAUTHORIZED_TO_UPDATE_DOCUMENT_REQUEST.code,
      errors.UNAUTHORIZED_TO_UPDATE_DOCUMENT_REQUEST.errorCode,
      errors.UNAUTHORIZED_TO_UPDATE_DOCUMENT_REQUEST.suggestion,
    );
  }

  // Prevent editing fulfilled requests
  if (request.status === "Fulfilled") {
    throw new AppError(
      errors.DOCUMENT_REQUEST_FULLFILLED.message,
      errors.DOCUMENT_REQUEST_FULLFILLED.code,
      errors.DOCUMENT_REQUEST_FULLFILLED.errorCode,
      errors.DOCUMENT_REQUEST_FULLFILLED.suggestion,
    );
  }

  const { title, description, scope, sprintId, taskId, dueDate } = data;

  // Validate the scope logic if edited
  if (
    scope !== request.scope ||
    sprintId !== request.sprintId?.toString() ||
    taskId !== request.taskId?.toString()
  ) {
    await validateDocumentRequestScope(
      scope,
      sprintId,
      taskId,
      request.projectId.toString(),
    );
  }

  // Apply the updates
  request.scope = scope ? scope : request.scope;
  request.sprintId = sprintId ? sprintId : request.sprintId;
  request.taskId = taskId ? taskId : request.taskId;

  if (title !== undefined) request.title = title;
  if (description !== undefined) request.description = description;
  if (dueDate !== undefined) request.dueDate = dueDate;

  // Save the changes
  await request.save();

  return {
    status: "Success",
    code: 200,
    message: "Document request updated successfully!",
    data: request,
  };
};

// Delete a document request (Only the creator of the request can delete the request)
export const deleteDocumentRequest = async (requestId, user) => {
  // Check the document request existence
  const request = await DocumentRequest.findById(requestId);
  if (!request) {
    throw new AppError(
      errors.DOCUMENT_REQUEST_NOT_FOUND.message,
      errors.DOCUMENT_REQUEST_NOT_FOUND.code,
      errors.DOCUMENT_REQUEST_NOT_FOUND.errorCode,
      errors.DOCUMENT_REQUEST_NOT_FOUND.suggestion,
    );
  }

  // Access control: Only the creator of the document request can delete it
  if (request.requestedBy.toString() !== user.id.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_DELETE_DOCUMENT_REQUEST.message,
      errors.UNAUTHORIZED_TO_DELETE_DOCUMENT_REQUEST.code,
      errors.UNAUTHORIZED_TO_DELETE_DOCUMENT_REQUEST.errorCode,
      errors.UNAUTHORIZED_TO_DELETE_DOCUMENT_REQUEST.suggestion,
    );
  }

  // Prevent deleting fulfilled requests (To not lose project documentation history)
  if (request.status === "Fulfilled") {
    throw new AppError(
      errors.DOCUMENT_REQUEST_FULLFILLED.message,
      errors.DOCUMENT_REQUEST_FULLFILLED.code,
      errors.DOCUMENT_REQUEST_FULLFILLED.errorCode,
      errors.DOCUMENT_REQUEST_FULLFILLED.suggestion,
    );
  }

  // Delete the document request
  await request.deleteOne();

  return {
    status: "Success",
    code: 200,
    message: "Document request deleted successfully!",
  };
};

// Mark a document request as fulfilled (Only the creator of the request can mark it as fulfilled)
export const markDocumentRequestAsFulfilled = async (requestId, user) => {
  // Check the document request existence
  const request = await DocumentRequest.findById(requestId);
  if (!request) {
    throw new AppError(
      errors.DOCUMENT_REQUEST_NOT_FOUND.message,
      errors.DOCUMENT_REQUEST_NOT_FOUND.code,
      errors.DOCUMENT_REQUEST_NOT_FOUND.errorCode,
      errors.DOCUMENT_REQUEST_NOT_FOUND.suggestion,
    );
  }

  // Authorization check: Only the creator of the document request can mark it as fulfilled
  if (request.createdBy.toString() !== user.id.toString()) {
    throw new AppError(
      errors.UNAUTHORIZED_TO_FULFILL_DOCUMENT_REQUEST.message,
      errors.UNAUTHORIZED_TO_FULFILL_DOCUMENT_REQUEST.code,
      errors.UNAUTHORIZED_TO_FULFILL_DOCUMENT_REQUEST.errorCode,
      errors.UNAUTHORIZED_TO_FULFILL_DOCUMENT_REQUEST.suggestion,
    );
  }

  // Prevent the double fulfillment
  if (request.status === "Fulfilled") {
    throw new AppError(
      errors.DOCUMENT_REQUEST_FULLFILLED.message,
      errors.DOCUMENT_REQUEST_FULLFILLED.code,
      errors.DOCUMENT_REQUEST_FULLFILLED.errorCode,
      errors.DOCUMENT_REQUEST_FULLFILLED.suggestion,
    );
  }

  // Update the document request status + save the changes
  request.status = "Fulfilled";
  request.fulfilledAt = new Date();
  await request.save();

  return {
    status: "Success",
    code: 200,
    message: "Document request marked as fulfilled!",
    data: request,
  };
};
