// Client-side mirror of api/_lib/businessHours.js -- used for instant
// feedback and the "Use next business hours" convenience button. The server
// re-validates independently before actually scheduling anything.
const TIMEZONE = "America/Los_Angeles";
const START_HOUR = 9;
const END_HOUR = 17;
const WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

function pacificParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday").value;
  let hour = Number(parts.find((p) => p.type === "hour").value);
  if (hour === 24) hour = 0;
  return { weekday, hour };
}

export function isWithinProfessionalHours(date) {
  const { weekday, hour } = pacificParts(date);
  return WEEKDAYS.has(weekday) && hour >= START_HOUR && hour < END_HOUR;
}

export function nextProfessionalHoursSlot(fromDate) {
  const date = new Date(fromDate.getTime());
  date.setSeconds(0, 0);
  const roundedUp = date.getMinutes() > 0;
  date.setMinutes(0);
  if (roundedUp) date.setTime(date.getTime() + 60 * 60 * 1000);
  for (let i = 0; i < 24 * 8; i++) {
    if (isWithinProfessionalHours(date)) return date;
    date.setTime(date.getTime() + 60 * 60 * 1000);
  }
  return date;
}

// A <input type="datetime-local"> has no timezone of its own -- its value is
// just wall-clock digits. Since professional hours are defined in Pacific
// time regardless of where a member is browsing from, these two helpers
// always read/write that value as Pacific wall-clock time, not the
// browser's local time.

export function toDatetimeLocalValue(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

export function pacificWallClockToDate(dateTimeLocalString) {
  const [datePart, timePart] = dateTimeLocalString.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  // Round-trip correction: guess the instant as if these numbers were UTC,
  // see what that instant looks like in Pacific time, and correct by the
  // difference -- this self-adjusts for PST vs PDT automatically.
  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(guessUtcMs));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  let seenHour = get("hour");
  if (seenHour === 24) seenHour = 0;
  const seenAsPacificMs = Date.UTC(get("year"), get("month") - 1, get("day"), seenHour, get("minute"));

  return new Date(guessUtcMs + (guessUtcMs - seenAsPacificMs));
}
