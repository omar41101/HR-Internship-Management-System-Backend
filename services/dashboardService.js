import * as projectAnalytics from "./analytics/projectAnalyticsService.js";

// Get Dashboard data for supervisors
export const getSupervisorDashboard = async (user) => {
  const [summaryPerMonth, globalStats] = await Promise.all([
    projectAnalytics.getProjectSummaryPerMonth(),
    projectAnalytics.getGlobalProjectStats(),
  ]);

  return {
    status: "Success",
    code: 200,
    message: "Supervisor dashboard retrieved successfully",
    data: {
      projectSummary: summaryPerMonth.data,
      globalProjectStats: globalStats.data,
    },
  };
};

// Get Dashboard data for Admins
export const getAdminDashboard = async (user) => {
  const globalStats = await projectAnalytics.getGlobalProjectStats();

  return {
    status: "Success",
    code: 200,
    message: "Admin dashboard retrieved successfully",
    data: {
      globalProjectStats: globalStats.data,
    },
  };
};
