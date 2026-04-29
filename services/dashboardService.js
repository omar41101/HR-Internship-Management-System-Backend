import * as projectAnalytics from "./analytics/projectAnalyticsService.js";
import * as userStatsService from "./analytics/userStatsService.js";

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
  const [userStats, projectStats] = await Promise.all([
    userStatsService.getUserStats(),
    projectAnalytics.getGlobalProjectStats(),
  ]);

  return {
    status: "Success",
    code: 200,
    message: "Admin dashboard retrieved successfully",
    data: {
      globalProjectStats: projectStats.data,
      userStats: userStats.data,
    },
  };
};
