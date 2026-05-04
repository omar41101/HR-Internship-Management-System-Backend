import User from "../../models/User.js";
import { getMonthRange } from "../../utils/timeHelpers.js";

export const getUserStats = async () => {
  const now = new Date();
  const { startOfThisMonth, startOfLastMonth } = getMonthRange(now.getFullYear(), now.getMonth() + 1);

  const result = await User.aggregate([
    {
      $facet: {
        employeesTotal: [
          {
            $match: {
              "employment.contractType": { $ne: "INTERNSHIP" },
            },
          },
          { $count: "count" },
        ],

        employeesThisMonth: [
          {
            $match: {
              "employment.contractType": { $ne: "INTERNSHIP" },
              createdAt: { $gte: startOfThisMonth },
            },
          },
          { $count: "count" },
        ],

        employeesLastMonth: [
          {
            $match: {
              "employment.contractType": { $ne: "INTERNSHIP" },
              createdAt: {
                $gte: startOfLastMonth,
                $lt: startOfThisMonth,
              },
            },
          },
          { $count: "count" },
        ],

        internsTotal: [
          {
            $match: {
              "employment.contractType": "INTERNSHIP",
            },
          },
          { $count: "count" },
        ],

        internsThisMonth: [
          {
            $match: {
              "employment.contractType": "INTERNSHIP",
              createdAt: { $gte: startOfThisMonth },
            },
          },
          { $count: "count" },
        ],

        internsLastMonth: [
          {
            $match: {
              "employment.contractType": "INTERNSHIP",
              createdAt: {
                $gte: startOfLastMonth,
                $lt: startOfThisMonth,
              },
            },
          },
          { $count: "count" },
        ],

        status: [
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  const data = result[0];

  const getCount = (arr) => arr?.[0]?.count || 0;

  return {
    status: "Success",
    code: 200,
    message: "User statistics retrieved successfully",
    data: {
      employees: {
        total: getCount(data.employeesTotal),
        thisMonth: getCount(data.employeesThisMonth),
        lastMonth: getCount(data.employeesLastMonth),
        growth:
          getCount(data.employeesThisMonth) - getCount(data.employeesLastMonth),
      },

      interns: {
        total: getCount(data.internsTotal),
        thisMonth: getCount(data.internsThisMonth),
        lastMonth: getCount(data.internsLastMonth),
        growth:
          getCount(data.internsThisMonth) - getCount(data.internsLastMonth),
      },

      status: {
        active: data.status.find((s) => s._id === "Active")?.count || 0,
        inactive: data.status.find((s) => s._id === "Inactive")?.count || 0,
        blocked: data.status.find((s) => s._id === "Blocked")?.count || 0,
        pending: data.status.find((s) => s._id === "Pending")?.count || 0,
      },
    },
  };
};
