// Utility functions to calculate date ranges for different periods (day, month, trimester, year)
export const getDayRange = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
};

export const getMonthRange = (year, month) => ({
  start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)), // Month - 1 because JS months start at 0
  end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),  // Last day of month
});

export const getTrimesterRange = (year, trimester) => {
  const startMonth = (trimester - 1) * 3;
  return {
    start: new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999)),
  };
};

export const getYearRange = (year) => ({
  start: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
  end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
});
