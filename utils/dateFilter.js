// Date filter utility for attendance records
export const buildDateFilter = ({ type, year, month, trimester, startDate, endDate }) => {
  let start, end;

  if (type === "month") {
    const start = new Date(Date.UTC(year, month - 1, 1)); // month-1 because JS months are 0-based
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    return { $gte: start, $lte: end };
  }

  else if (type === "trimester") {  // The Admin chose By trimester as a filter type
    const startMonth = (trimester - 1) * 3;
    start = new Date(Date.UTC(year, startMonth, 1));
    end = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999));
  }

  else if (type === "year") {  // The Admin chose By year as a filter type
    start = new Date(Date.UTC(year, 0, 1));
    end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  }

  else if (type === "custom") { // The Admin chose Custom range (Flexible date range) as a filter type
    if (!startDate || !endDate) {
      throw new Error("Custom range requires startDate and endDate!");
    } 

    start = new Date(startDate);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      throw new Error("Start date must be before end date!");
    }
  }

  return { $gte: start, $lte: end };
}; 