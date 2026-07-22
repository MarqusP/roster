export default function StatStrip({ alumni, statusOf }) {
  const counts = { none: 0, contacted: 0, replied: 0, meeting: 0 };
  alumni.forEach((a) => {
    const s = statusOf(a.id);
    if (s === "contacted") counts.contacted += 1;
    else if (s === "replied") counts.replied += 1;
    else if (s === "meeting") counts.meeting += 1;
    else counts.none += 1;
  });

  return (
    <section className="stat-strip">
      <div className="stat-box">
        <span className="stat-num">{alumni.length}</span>
        <span className="stat-label">Total Alumni</span>
      </div>
      <div className="stat-box">
        <span className="stat-num">{counts.none}</span>
        <span className="stat-label">Not Contacted</span>
      </div>
      <div className="stat-box">
        <span className="stat-num">{counts.contacted}</span>
        <span className="stat-label">Contacted</span>
      </div>
      <div className="stat-box">
        <span className="stat-num">{counts.replied}</span>
        <span className="stat-label">Replied</span>
      </div>
    </section>
  );
}
