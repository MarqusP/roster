import { useState } from "react";
import { useToast } from "./ToastProvider.jsx";

const CONFIRM_PHRASE = "DELETE";

export default function ChapterSettingsModal({ open, onClose, onClearAll }) {
  const showToast = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);

  function close() {
    setConfirmText("");
    onClose();
  }

  async function handleClearAll() {
    setClearing(true);
    try {
      await onClearAll();
      showToast("Roster cleared.");
      close();
    } catch (err) {
      showToast("Couldn't clear the roster — try again.", "error");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className={`modal${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="modal-inner">
        <button className="close-x" onClick={close} aria-label="Close">×</button>
        <h2>Chapter Settings</h2>
        <p className="modal-sub">Admin-only controls for this chapter's shared roster.</p>

        <div className="danger-zone">
          <p>
            Permanently deletes every alumni record for everyone using this tool. This cannot be undone
            — chapter members will need to re-import the roster from scratch.
          </p>
          <div className="field">
            <label className="field-label">Type {CONFIRM_PHRASE} to confirm</label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
            />
          </div>
          <button
            className="btn btn-sm btn-danger"
            disabled={confirmText.trim() !== CONFIRM_PHRASE || clearing}
            onClick={handleClearAll}
          >
            {clearing ? "Clearing…" : "Permanently delete roster"}
          </button>
        </div>
      </div>
    </div>
  );
}
