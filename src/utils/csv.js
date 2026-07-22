import Papa from "papaparse";

// Fixed column schema -- CSVs must use these exact header names (case- and
// spacing-insensitive). No manual column-matching step: a header either
// matches one of these canonical names or it's ignored.
export const FIXED_COLUMNS = [
  { key: "name", header: "Name", required: true },
  { key: "email", header: "Email" },
  { key: "company", header: "Company" },
  { key: "title", header: "Title" },
  { key: "industry", header: "Industry" },
  { key: "location", header: "Location" },
  { key: "gradYear", header: "Grad Year" },
  { key: "linkedin", header: "LinkedIn" },
];

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function parseCsv(text) {
  const result = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  return { headers: result.meta?.fields || [], rows: result.data || [] };
}

// Which fixed columns were actually found in this CSV's headers.
export function matchColumns(headers) {
  return FIXED_COLUMNS.filter((col) => {
    const target = normalizeHeader(col.header);
    return headers.some((h) => normalizeHeader(h) === target);
  });
}

export function rowsToRecords(rows, headers) {
  const columnByKey = {};
  FIXED_COLUMNS.forEach((col) => {
    const target = normalizeHeader(col.header);
    columnByKey[col.key] = headers.find((h) => normalizeHeader(h) === target) || "";
  });

  return rows
    .map((row) => {
      const record = {};
      FIXED_COLUMNS.forEach((col) => {
        const sourceHeader = columnByKey[col.key];
        record[col.key] = ((sourceHeader ? row[sourceHeader] : "") || "").trim();
      });
      return record;
    })
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
