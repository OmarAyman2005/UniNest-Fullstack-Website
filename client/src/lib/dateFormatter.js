// dateFormatter.js

// (UPDATED) Properly format an ISO/UTC string in the user's *local* timezone.
export const formatLocalTime = (isoString) => {
  if (!isoString) return "";
  const dt = new Date(isoString); // Date parses ISO; getters below return *local* time
  const pad = (n) => String(n).padStart(2, "0");

  const day = pad(dt.getDate());
  const month = pad(dt.getMonth() + 1);
  const year = dt.getFullYear();

  let hour = dt.getHours();              // local hour
  const minute = pad(dt.getMinutes());   // local minute
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;

  return `${day}/${month}/${year} ${hour}:${minute} ${ampm}`;
};

// (UPDATED earlier) Correct conversion for <input type="datetime-local"> values.
// The string is interpreted as local; toISOString() converts it to UTC.
export const convertToUTC = (localDateTimeStr) => {
  if (!localDateTimeStr) return "";
  return new Date(localDateTimeStr).toISOString();
};
