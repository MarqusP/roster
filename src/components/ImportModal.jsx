import { useState } from "react";
import { FIXED_COLUMNS, parseCsv, matchColumns, rowsToRecords } from "../utils/csv.js";
import { useToast } from "./ToastProvider.jsx";

const MANUAL_FIELDS = [
  { key: "name", label: "Name*" },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title / Role" },
  { key: "industry", label: "Industry" },
  { key: "location", label: "Location" },
  { key: "gradYear", label: "Grad Year" },
  { key: "linkedin", label: "LinkedIn" },
];

const EMPTY_MANUAL = { name: "", email: "", company: "", title: "", industry: "", location: "", gradYear: "", linkedin: "" };

export default function ImportModal({ open, onClose, onImport, onManualAdd }) {
  const showToast = useToast();
  const [tab, setTab] = useState("csv");
  const [pasteText, setPasteText] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [manual, setManual] = useState(EMPTY_MANUAL);

  function resetImportState() {
    setHeaders([]);
    setRows([]);
    setPasteText("");
  }

  function handleParsed(text) {
    if (!text || !text.trim()) {
      showToast("Nothing to parse — upload a file or paste some data first.", "error");
      return;
    }
    const { headers: h, rows: r } = parseCsv(text);
    if (h.length === 0) {
      showToast("Couldn't read that as CSV — check the format and try again.", "error");
      return;
    }
    if (!rowsToRecords(r, h).length) {
      showToast("No \"Name\" column found — make sure your first row has a Name header.", "error");
      return;
    }
    setHeaders(h);
    setRows(r);
  }

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleParsed(String(reader.result));
    reader.onerror = () => showToast("Couldn't read that file — try pasting the data instead.", "error");
    reader.readAsText(file);
  }

  async function confirmImport() {
    const records = rowsToRecords(rows, headers);
    const { added, updated } = await onImport(records);
    resetImportState();
    onClose();
    showToast(`Imported ${added} new and updated ${updated} existing alumni.`);
  }

  async function submitManual() {
    if (!manual.name.trim()) {
      showToast("Name is required.", "error");
      return;
    }
    const name = manual.name.trim();
    await onManualAdd({ ...manual, name });
    setManual(EMPTY_MANUAL);
    onClose();
    showToast(`${name} added to the roster.`);
  }

  function close() {
    resetImportState();
    onClose();
  }

  return (
    <div className={`modal${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="modal-inner">
        <button className="close-x" onClick={close} aria-label="Close">×</button>
        <h2>Add alumni</h2>
        <p className="modal-sub">Shared with everyone using this roster — imported or added data is visible to your whole chapter.</p>

        <div className="tabs">
          <button className={`tab-btn${tab === "csv" ? " active" : ""}`} onClick={() => setTab("csv")}>Import from Google Sheet</button>
          <button className={`tab-btn${tab === "manual" ? " active" : ""}`} onClick={() => setTab("manual")}>Add one by hand</button>
        </div>

        <div className={`tab-panel${tab === "csv" ? " active" : ""}`}>
          <p className="modal-sub">
            Your sheet's first row must use these exact column headers (order doesn't matter, extra columns are
            ignored): <strong>{FIXED_COLUMNS.map((c) => c.header).join(", ")}</strong>. Only Name is required.
          </p>
          <p className="modal-sub">In Google Sheets: File → Download → Comma-separated values, then upload it here. Or paste the data directly.</p>
          <input type="file" accept=".csv,text/csv" onChange={handleFile} />
          <p className="modal-sub" style={{ margin: "10px 0 4px" }}>— or paste CSV text —</p>
          <textarea
            rows={4}
            style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: 6 }}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <div className="row-actions">
            <button className="btn btn-sm btn-ghost" onClick={() => handleParsed(pasteText)}>Parse pasted data</button>
          </div>

          {headers.length > 0 && (
            <div>
              <p className="modal-sub" style={{ marginTop: 16 }}>
                Found {rows.length} rows. Recognized columns:{" "}
                {matchColumns(headers).map((c) => c.header).join(", ") || "none"}
              </p>
              <div className="row-actions">
                <button className="btn btn-brass" onClick={confirmImport}>Import into roster</button>
              </div>
            </div>
          )}
        </div>

        <div className={`tab-panel${tab === "manual" ? " active" : ""}`}>
          {MANUAL_FIELDS.map(({ key, label }) => (
            <div className="field" key={key}>
              <label className="field-label">{label}</label>
              <input
                type="text"
                value={manual[key]}
                onChange={(e) => setManual((m) => ({ ...m, [key]: e.target.value }))}
              />
            </div>
          ))}
          <button className="btn btn-brass" onClick={submitManual}>Add to roster</button>
        </div>
      </div>
    </div>
  );
}
