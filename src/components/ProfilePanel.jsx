import { useEffect, useRef, useState } from "react";
import { useToast } from "./ToastProvider.jsx";
import { auth } from "../firebase.js";
import { isWithinProfessionalHours, nextProfessionalHoursSlot, toDatetimeLocalValue, pacificWallClockToDate } from "../utils/businessHours.js";

const NOTES_SAVE_DELAY = 800;

const STATUS_LABELS = {
  "not-contacted": "Not Contacted",
  contacted: "Contacted",
  replied: "Replied",
  meeting: "Meeting Scheduled",
};

export default function ProfilePanel({ alum, entry, myInfo, chapterName, open, onClose, onSaveStatus }) {
  const showToast = useToast();
  const [purpose, setPurpose] = useState("informational");
  const [context, setContext] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("not-contacted");
  const [notes, setNotes] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachResume, setAttachResume] = useState(Boolean(myInfo?.resume));
  const [sendMode, setSendMode] = useState("now");
  const [scheduledFor, setScheduledFor] = useState("");
  const statusRef = useRef(status);
  const notesTimerRef = useRef(null);

  useEffect(() => {
    if (!alum) return;
    setPurpose("informational");
    setContext("");
    setSubject("");
    setBody("");
    setStatus(entry?.status || "not-contacted");
    setNotes(entry?.notes || "");
    setAttachResume(Boolean(myInfo?.resume));
    setSendMode("now");
    setScheduledFor(toDatetimeLocalValue(nextProfessionalHoursSlot(new Date())));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alum?.id]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  if (!alum) return null;

  function handleStatusChange(newStatus) {
    setStatus(newStatus);
    onSaveStatus(alum.id, newStatus, notes);
    showToast("Status updated.");
  }

  function handleNotesChange(newNotes) {
    setNotes(newNotes);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => {
      onSaveStatus(alum.id, statusRef.current, newNotes);
    }, NOTES_SAVE_DELAY);
  }

  async function draftEmail() {
    setDrafting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ alum, purpose, context, myInfo, chapterName }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || "Couldn't reach the draft assistant — write your own below, or try again.", "error");
        return;
      }
      const data = await res.json();
      setSubject(data.subject || "");
      setBody(data.body || "");
      showToast("Draft ready — edit it to sound like you before sending.");
    } catch (err) {
      showToast("Couldn't reach the draft assistant — write your own below, or try again.", "error");
    } finally {
      setDrafting(false);
    }
  }

  async function copyDraft() {
    const text = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard.");
    } catch (err) {
      showToast("Could not copy — select the text and copy manually.", "error");
    }
  }

  function openMailto() {
    if (!alum.email) {
      showToast("This alum has no email on file.", "error");
      return;
    }
    const href = `mailto:${encodeURIComponent(alum.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  }

  async function sendEmail() {
    if (!alum.email) {
      showToast("This alum has no email on file.", "error");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      showToast("Write a subject and body before sending.", "error");
      return;
    }
    setSending(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          to: alum.email,
          subject,
          body,
          replyTo: auth.currentUser?.email || undefined,
          attachResume: attachResume && Boolean(myInfo?.resume?.data),
          resumeData: myInfo?.resume?.data,
          resumeFilename: myInfo?.resume?.filename,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || "Couldn't send the email — try again.", "error");
        return;
      }
      showToast(attachResume && myInfo?.resume ? "Email sent with your resume attached." : "Email sent.");
    } catch (err) {
      showToast("Couldn't send the email — try again.", "error");
    } finally {
      setSending(false);
    }
  }

  async function scheduleEmailSend() {
    if (!alum.email) {
      showToast("This alum has no email on file.", "error");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      showToast("Write a subject and body before scheduling.", "error");
      return;
    }
    const scheduledDate = pacificWallClockToDate(scheduledFor);
    if (scheduledDate.getTime() <= Date.now()) {
      showToast("Pick a time in the future.", "error");
      return;
    }
    if (!isWithinProfessionalHours(scheduledDate)) {
      showToast("Scheduled time must be a weekday between 9am and 5pm Pacific.", "error");
      return;
    }
    setSending(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/schedule-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          to: alum.email,
          subject,
          body,
          replyTo: auth.currentUser?.email || undefined,
          attachResume: attachResume && Boolean(myInfo?.resume?.data),
          resumeData: myInfo?.resume?.data,
          resumeFilename: myInfo?.resume?.filename,
          scheduledFor: scheduledDate.toISOString(),
          alumName: alum.name,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || "Couldn't schedule the email — try again.", "error");
        return;
      }
      showToast(`Email scheduled for ${scheduledDate.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`);
    } catch (err) {
      showToast("Couldn't schedule the email — try again.", "error");
    } finally {
      setSending(false);
    }
  }

  function useNextBusinessHours() {
    setScheduledFor(toDatetimeLocalValue(nextProfessionalHoursSlot(new Date())));
  }

  const history = entry?.history || [];

  return (
    <aside className={`profile-panel${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="panel-inner">
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="roll-stamp">No. {String(alum.seq || 0).padStart(3, "0")}</div>
        <h2>{alum.name || "Unnamed alum"}</h2>
        <p className="panel-role">{[alum.title, alum.company].filter(Boolean).join(" at ")}</p>
        <dl className="panel-meta">
          {alum.industry && (<><dt>Industry</dt><dd>{alum.industry}</dd></>)}
          {alum.location && (<><dt>Location</dt><dd>{alum.location}</dd></>)}
          {alum.gradYear && (<><dt>Grad Year</dt><dd>{alum.gradYear}</dd></>)}
          {alum.email && (<><dt>Email</dt><dd>{alum.email}</dd></>)}
          {alum.linkedin && (<><dt>LinkedIn</dt><dd>{alum.linkedin}</dd></>)}
        </dl>

        <hr className="divider" />
        <h3>Draft outreach</h3>
        <div className="field">
          <label className="field-label">Purpose</label>
          <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            <option value="informational">Informational interview</option>
            <option value="referral">Advice / referral for a role</option>
            <option value="breaking-in">Breaking into their industry</option>
            <option value="general">General networking</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label">Anything specific to mention (optional)</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g. I'm especially interested in their move from consulting to product…"
          />
        </div>
        <button className="btn btn-brass" onClick={draftEmail} disabled={drafting}>
          {drafting ? "Drafting…" : "Draft with AI"}
        </button>

        <div className="field" style={{ marginTop: 14 }}>
          <label className="field-label">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject will appear here"
          />
        </div>
        <div className="field">
          <label className="field-label">Body</label>
          <textarea
            style={{ minHeight: 160 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Draft will appear here — edit freely before sending."
          />
        </div>
        {myInfo?.resume && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, margin: "10px 0" }}>
            <input type="checkbox" checked={attachResume} onChange={(e) => setAttachResume(e.target.checked)} />
            Attach my resume ({myInfo.resume.filename})
          </label>
        )}

        <div className="field">
          <label className="field-label">When to send</label>
          <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="radio" name="sendMode" checked={sendMode === "now"} onChange={() => setSendMode("now")} />
              Now
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="radio" name="sendMode" checked={sendMode === "schedule"} onChange={() => setSendMode("schedule")} />
              Schedule for later
            </label>
          </div>
        </div>

        {sendMode === "schedule" && (
          <div className="field">
            <label className="field-label">Send time (Pacific, weekdays 9am–5pm)</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <button type="button" className="btn btn-sm btn-ghost" onClick={useNextBusinessHours}>
                Use next business hours
              </button>
            </div>
          </div>
        )}

        <div className="row-actions">
          <button className="btn btn-sm btn-ghost" onClick={copyDraft}>Copy</button>
          <button className="btn btn-sm btn-ghost" onClick={openMailto}>Open in email app</button>
          {sendMode === "now" ? (
            <button className="btn btn-sm btn-brass" onClick={sendEmail} disabled={sending}>
              {sending ? "Sending…" : "Send email"}
            </button>
          ) : (
            <button className="btn btn-sm btn-brass" onClick={scheduleEmailSend} disabled={sending}>
              {sending ? "Scheduling…" : "Schedule send"}
            </button>
          )}
        </div>

        <hr className="divider" />
        <h3>Outreach status</h3>
        <div className="field">
          <label className="field-label">Status</label>
          <select value={status} onChange={(e) => handleStatusChange(e.target.value)}>
            <option value="not-contacted">Not Contacted</option>
            <option value="contacted">Contacted</option>
            <option value="replied">Replied</option>
            <option value="meeting">Meeting Scheduled</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label">Notes — saves automatically</label>
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="What did you talk about? Any follow-up needed?"
          />
        </div>
        <ul className="history-list">
          {history.slice().reverse().slice(0, 6).map((h, i) => (
            <li key={i}>{h.date} — {STATUS_LABELS[h.status]} (by {h.by || "—"})</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
