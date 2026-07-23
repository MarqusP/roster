import { useState } from "react";
import { auth } from "../firebase.js";
import { useToast } from "./ToastProvider.jsx";

function formatScheduledFor(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ScheduledEmailsModal({ open, onClose, scheduled }) {
  const showToast = useToast();
  const [cancelingId, setCancelingId] = useState(null);

  async function cancel(item) {
    setCancelingId(item.id);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/cancel-scheduled-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ docId: item.id, qstashMessageId: item.qstashMessageId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || "Couldn't cancel — try again.", "error");
        return;
      }
      showToast("Scheduled email canceled.");
    } catch (err) {
      showToast("Couldn't cancel — try again.", "error");
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <div className={`modal${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="modal-inner">
        <button className="close-x" onClick={onClose} aria-label="Close">×</button>
        <h2>Scheduled Emails</h2>
        <p className="modal-sub">Emails you've scheduled that haven't gone out yet.</p>

        {scheduled.length === 0 ? (
          <p className="modal-sub">Nothing scheduled right now.</p>
        ) : (
          <ul className="history-list">
            {scheduled.map((item) => (
              <li key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span>
                  <strong style={{ fontFamily: "var(--font-display)" }}>{item.alumName || item.to}</strong>
                  {" — "}
                  {item.subject}
                  <br />
                  {formatScheduledFor(item.scheduledFor)}
                  {item.hasResumeAttached ? " · resume attached" : ""}
                </span>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => cancel(item)}
                  disabled={cancelingId === item.id}
                >
                  {cancelingId === item.id ? "Canceling…" : "Cancel"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
