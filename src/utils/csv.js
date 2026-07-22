import Papa from "papaparse";

export const FIELD_TARGETS = [
  { key: "name", label: "Name*", aliases: ["name", "full name", "alumni name", "alum name"] },
  { key: "email", label: "Email", aliases: ["email", "e-mail"] },
  { key: "company", label: "Company", aliases: ["company", "employer", "organization"] },
  { key: "title", label: "Title / Role", aliases: ["title", "role", "position", "job title"] },
  { key: "industry", label: "Industry", aliases: ["industry", "sector", "field"] },
  { key: "location", label: "Location", aliases: ["location", "city", "state"] },
  { key: "gradYear", label: "Grad Year", aliases: ["grad", "year", "class"] },
  { key: "linkedin", label: "LinkedIn", aliases: ["linkedin", "profile"] },
];

export function parseCsv(text) {
  const result = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  return { headers: result.meta?.fields || [], rows: result.data || [] };
}

export function guessHeader(headers, aliases) {
  const lower = headers.map((h) => h.toLowerCase());
  for (const alias of aliases) {
    const idx = lower.findIndex((h) => h.includes(alias));
    if (idx !== -1) return headers[idx];
  }
  return "";
}

export function rowsToRecords(rows, mapping) {
  return rows
    .map((row) => ({
      name: ((mapping.name ? row[mapping.name] : "") || "").trim(),
      email: ((mapping.email ? row[mapping.email] : "") || "").trim(),
      company: ((mapping.company ? row[mapping.company] : "") || "").trim(),
      title: ((mapping.title ? row[mapping.title] : "") || "").trim(),
      industry: ((mapping.industry ? row[mapping.industry] : "") || "").trim(),
      location: ((mapping.location ? row[mapping.location] : "") || "").trim(),
      gradYear: ((mapping.gradYear ? row[mapping.gradYear] : "") || "").trim(),
      linkedin: ((mapping.linkedin ? row[mapping.linkedin] : "") || "").trim(),
    }))
    .filter((r) => r.name);
}

function escapeCsvValue(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

export function toCsv(alumni, outreachLog, statusLabel) {
  const headers = [
    "Name", "Email", "Company", "Title", "Industry", "Location",
    "Grad Year", "LinkedIn", "Status", "Notes", "Last Contacted",
  ];
  const lines = [headers.join(",")];
  alumni.forEach((a) => {
    const entry = outreachLog[a.id] || {};
    lines.push(
      [
        a.name, a.email, a.company, a.title, a.industry, a.location,
        a.gradYear, a.linkedin, statusLabel(entry.status || "not-contacted"),
        entry.notes || "", entry.lastContactedDate || "",
      ]
        .map(escapeCsvValue)
        .join(",")
    );
  });
  return lines.join("\n");
}
