import { useEffect, useState } from "react";
import { useToast } from "./ToastProvider.jsx";

// Resumes are stored inline in the user's Firestore doc (base64), which caps
// out at 1MB per document. Capped well under that to leave room for the rest
// of the doc (outreach log, etc.) -- covers the ~50-500KB range typical
// resume PDFs fall into.
const MAX_RESUME_BYTES = 600 * 1024;

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function MyInfoModal({ open, myInfo, onSave, onClose }) {
  const showToast = useToast();
  const [name, setName] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [major, setMajor] = useState("");
  const [resume, setResume] = useState(null);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(myInfo.name || "");
      setGradYear(myInfo.gradYear || "");
      setMajor(myInfo.major || "");
      setResume(myInfo.resume || null);
    }
  }, [open, myInfo]);

  async function handleResumeFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      showToast("Resume must be a PDF.", "error");
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      showToast(`Resume must be under ${Math.round(MAX_RESUME_BYTES / 1024)}KB.`, "error");
      return;
    }
    setReading(true);
    try {
      const data = await readFileAsBase64(file);
      setResume({ filename: file.name, data, size: file.size, uploadedAt: new Date().toISOString() });
      showToast("Resume ready — click Save to keep it.");
    } catch (err) {
      showToast("Couldn't read that file — try again.", "error");
    } finally {
      setReading(false);
    }
  }

  function removeResume() {
    setResume(null);
  }

  function save() {
    onSave({ name: name.trim(), gradYear: gradYear.trim(), major: major.trim(), resume });
    onClose();
  }

  return (
    <div className={`modal${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="modal-inner">
        <button className="close-x" onClick={onClose} aria-label="Close">×</button>
        <h2>My info</h2>
        <p className="modal-sub">Only visible to you — used to personalize drafted emails.</p>
        <div className="field">
          <label className="field-label">Your name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Grad year</label>
          <input type="text" value={gradYear} onChange={(e) => setGradYear(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Major / focus</label>
          <input type="text" value={major} onChange={(e) => setMajor(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Resume (PDF, under {Math.round(MAX_RESUME_BYTES / 1024)}KB)</label>
          <p className="modal-sub" style={{ margin: "0 0 10px" }}>
            Referenced by the AI when drafting emails, and can be attached when you send.
          </p>
          {resume ? (
            <div className="row-actions" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13 }}>{resume.filename}</span>
              <button className="btn btn-sm btn-ghost" onClick={removeResume} disabled={reading}>Remove</button>
            </div>
          ) : null}
          <input type="file" accept="application/pdf" onChange={handleResumeFile} disabled={reading} />
          {reading && <p className="modal-sub" style={{ margin: "6px 0 0" }}>Reading file…</p>}
        </div>
        <button className="btn btn-brass" onClick={save}>Save</button>
      </div>
    </div>
  );
}
