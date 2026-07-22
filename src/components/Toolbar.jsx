export default function Toolbar({ filters, onChange, industries }) {
  return (
    <section className="toolbar">
      <input
        type="text"
        placeholder="Search name, company, role, location…"
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
      />
      <select value={filters.industry} onChange={(e) => onChange({ ...filters, industry: e.target.value })}>
        <option value="all">All Industries</option>
        {industries.map((i) => (
          <option key={i} value={i}>{i}</option>
        ))}
      </select>
      <select value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value })}>
        <option value="all">All Statuses</option>
        <option value="not-contacted">Not Contacted</option>
        <option value="contacted">Contacted</option>
        <option value="replied">Replied</option>
        <option value="meeting">Meeting Scheduled</option>
      </select>
      <select value={filters.sort} onChange={(e) => onChange({ ...filters, sort: e.target.value })}>
        <option value="name">Sort: Name</option>
        <option value="company">Sort: Company</option>
        <option value="industry">Sort: Industry</option>
        <option value="status">Sort: Status</option>
        <option value="recent">Sort: Recently Added</option>
      </select>
    </section>
  );
}
