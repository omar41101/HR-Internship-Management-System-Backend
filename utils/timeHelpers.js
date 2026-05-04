// ------------------------------------------------------------------- //
// ----------- Helper functions related to Time and Dates ------------ //
// ------------------------------------------------------------------- //
 
// Get the start and end dates of a given month and year
export const getMonthRange = (year, month) => ({
  monthStart: new Date(year, month - 1, 1),
  monthEnd: new Date(year, month, 0),
});

// Get the difference in hours between two time strings (HH:MM)
export const getHoursDifference = (start, end) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  return (endMinutes - startMinutes) / 60;
};

// Get the week number of the year for a given date 
export const getWeekNumber = (date) => {
  const temp = new Date(date.getTime());
  temp.setHours(0, 0, 0, 0);

  // Set to nearest Thursday (Because the week number is based on the week containing the first Thursday of the year)
  temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
  
  // January 4th is always in the first week of the year
  const week1 = new Date(temp.getFullYear(), 0, 4);

  // 86400000 = number of ms in a day
  return (
    1 +
    Math.round(((temp - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  );
};

// Return all the days between two dates (Inclusive)
export const getDatesBetween = (start, end) => {
  const dates = [];

  let current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};
