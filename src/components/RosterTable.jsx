const STATUS_LABELS = {
  "not-contacted": "Not Contacted",
  contacted: "Contacted",
  replied: "Replied",
  meeting: "Meeting Scheduled",
};

export default function RosterTable({ alumni, filtered, statusOf, onOpen, onAddClick }) {
  if (alumni.length === 0) {
    return (
      <div className="roster-card">
        <div className="empty-state">
          <h3>The roster is empty</h3>
          <p>Import your chapter's alumni sheet, or add someone by hand, to start tracking outreach.</p>
          <button className="btn btn-brass" onClick={onAddClick}>+ Add Alumni</button>
        </div>
      </div>
    );
  }

  return (
    <div className="roster-card">
      <table>
        <thead>
          <tr>
            <th>No.</th>
            <th>Name</th>
            <th>Company &amp; Role</th>
            <th>Industry</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", color: "var(--muted-foreground)", padding: 30 }}>
                No alumni match these filters.
              </td>
            </tr>
          )}
          {filtered.map((a) => {
            const s = statusOf(a.id);
            const roll = String(a.seq || 0).padStart(3, "0");
            return (
              <tr key={a.id} onClick={() => onOpen(a.id)}>
                <td className="roll" data-label="No.">{roll}</td>
                <td className="name-cell" data-label="Name">
                  <strong>{a.name || "—"}</strong>
                  <span>{a.location || ""}</span>
                </td>
                <td data-label="Company & Role">
                  {a.company || "—"}
                  {a.title ? <span style={{ color: "var(--muted-foreground)" }}> · {a.title}</span> : null}
                </td>
                <td data-label="Industry">
                  {a.industry ? (
                    <span className="industry-pill">{a.industry}</span>
                  ) : (
                    <span style={{ color: "var(--muted-foreground)" }}>—</span>
                  )}
                </td>
                <td data-label="Status">
                  <span className={`status-dot ${s}`}>{STATUS_LABELS[s]}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
