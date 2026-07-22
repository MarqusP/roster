export default function Letterhead({ chapterName, onChapterNameChange, onOpenMyInfo, onExport, onOpenAdd, user, onSignOut }) {
  return (
    <header className="letterhead">
      <div className="letterhead-left">
        <h1 className="wordmark">The Roster</h1>
        <input
          key={chapterName}
          className="chapter-input"
          type="text"
          placeholder="Your chapter name (e.g. Sigma Chi — Epsilon)"
          defaultValue={chapterName}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== chapterName) onChapterNameChange(v);
          }}
        />
        <p className="tagline">Alumni network &amp; outreach log</p>
      </div>
      <div className="letterhead-actions">
        <button className="btn btn-ghost" onClick={onOpenMyInfo}>My Info</button>
        <button className="btn btn-ghost" onClick={onExport}>Export CSV</button>
        <button className="btn btn-brass" onClick={onOpenAdd}>+ Add Alumni</button>
        {user && (
          <span className="user-badge" title={user.email}>
            {user.displayName || user.email}
            <button className="btn btn-ghost btn-sm" onClick={onSignOut}>Sign out</button>
          </span>
        )}
      </div>
    </header>
  );
}
