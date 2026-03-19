// Attendance export helper functions for CSV and Excel formats
import { Parser } from "json2csv";
import ExcelJS from "exceljs";

// CSV Export function
export const exportCSV = (data, res, fileName) => {
  const parser = new Parser();
  const csv = parser.parse(data);

  res.header("Content-Type", "text/csv");
  res.attachment(fileName); // The filename will be the user's name + the filter type (e.g., "John_Doe_Monthly_Attendance.csv")
  return res.send(csv);
};

// Excel Export function
export const exportExcel = async (data, res, fileName) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Attendance");

  worksheet.columns = [
    { header: "Date", key: "Date", width: 15 },
    { header: "Check In", key: "CheckIn", width: 20 },
    { header: "Check Out", key: "CheckOut", width: 20 },
    { header: "Status", key: "Status", width: 15 },
  ];

  worksheet.addRows(data);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${fileName}`
  );

  await workbook.xlsx.write(res);
  res.end();
};

// Sanitize the user's name for the filename (replace spaces with underscores)
export const sanitize = (str) => str.replace(/\s+/g, "_");

// Get a human-readable label for the period based on the filter type and parameters
export const getPeriodLabel = ({ type, year, month, trimester, startDate, endDate }) => {
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  if (type === "month") return `${months[month - 1]}_${year}`;
  if (type === "trimester") return `T${trimester}_${year}`;
  if (type === "year") return `${year}`;

  if (type === "custom") {
    const format = (d) => new Date(d).toISOString().split("T")[0]; // Format as YYYY-MM-DD
    return `${format(startDate)}_to_${format(endDate)}`; // e.g., "2024-01-01_to_2024-03-31"
  }

  return "period";
};