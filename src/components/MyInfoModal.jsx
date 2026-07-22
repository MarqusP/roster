import { useEffect, useState } from "react";

export default function MyInfoModal({ open, myInfo, onSave, onClose }) {
  const [name, setName] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [major, setMajor] = useState("");

  useEffect(() => {
    if (open) {
      setName(myInfo.name || "");
      setGradYear(myInfo.gradYear || "");
      setMajor(myInfo.major || "");
    }
  }, [open, myInfo]);

  function save() {
    onSave({ name: name.trim(), gradYear: gradYear.trim(), major: major.trim() });
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
        <button className="btn btn-brass" onClick={save}>Save</button>
      </div>
    </div>
  );
}
