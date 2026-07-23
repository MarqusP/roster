// "Professional hours" for scheduled sends: Mon-Fri, 9am-5pm, Pacific Time.
// Uses Intl.DateTimeFormat against a fixed IANA zone so this is correct across
// PST/PDT transitions regardless of the server's own timezone.
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

// Walks forward to the next moment inside professional hours. Used for the
// "Use next business hours" convenience button, not for validation itself.
export function nextProfessionalHoursSlot(fromDate) {
  const date = new Date(fromDate.getTime());
  date.setSeconds(0, 0);
  // Round up to the next hour boundary so the slot always lands on :00.
  const roundedUp = date.getMinutes() > 0;
  date.setMinutes(0);
  if (roundedUp) date.setTime(date.getTime() + 60 * 60 * 1000);
  for (let i = 0; i < 24 * 8; i++) {
    if (isWithinProfessionalHours(date)) return date;
    date.setTime(date.getTime() + 60 * 60 * 1000);
  }
  return date;
}
