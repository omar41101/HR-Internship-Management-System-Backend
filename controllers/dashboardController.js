import * as dashboardService from "../services/dashboardService.js";

// Supervisor Dashboard
export const getSupervisorDashboard = async (req, res, next) => {
  try {
    const result = await dashboardService.getSupervisorDashboard(req.user);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};

// Admin Dashboard
export const getAdminDashboard = async (req, res, next) => {
  try {
    const result = await dashboardService.getAdminDashboard(req.user);
    res.status(result.code).json(result);
  } catch (err) {
    next(err);
  }
};
