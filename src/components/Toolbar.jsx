import { useState } from "react";

// Below this fraction of alumni having a non-empty `industry` value, the
// Industry filter is mostly a no-op, so we surface a note instead of letting
// it look broken.
const INDUSTRY_COVERAGE_THRESHOLD = 0.2;

export default function Toolbar({ filters, onChange, industries, industryFillRate }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const industryDataIncomplete = industryFillRate < INDUSTRY_COVERAGE_THRESHOLD;

  return (
    <section className="toolbar">
      <div className="toolbar-search-row">
        <input
          type="text"
          placeholder="Search name, company, role, location…"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
        />
        <button
          type="button"
          className="btn btn-sm btn-ghost filter-toggle"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
        >
          Filters {filtersOpen ? "▲" : "▼"}
        </button>
      </div>
      <div className={`toolbar-filters${filtersOpen ? " open" : ""}`}>
        <div className="industry-filter-group">
          <select value={filters.industry} onChange={(e) => onChange({ ...filters, industry: e.target.value })}>
            <option value="all">All Industries</option>
            {industries.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          {industryDataIncomplete && (
            <span className="industry-filter-note">Industry data is incomplete for this chapter</span>
          )}
        </div>
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
      </div>
    </section>
  );
}
