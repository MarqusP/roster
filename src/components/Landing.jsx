const FEATURES = [
  {
    num: "01",
    title: "Shared Roster",
    body: "One living directory the whole chapter shares. Add a recruiter or industry contact you know, and every member benefits from it — not just you. Help each other out.",
  },
  {
    num: "02",
    title: "Outreach Tracking",
    body: "Mark who you've contacted, who's replied, who's scheduled a meeting. Your progress follows your account, not your browser.",
  },
  {
    num: "03",
    title: "AI-Drafted Emails",
    body: "Pick a purpose — informational interview, referral, general networking — and get a personalized draft to edit and send.",
  },
];

const HOW_IT_WORKS = [
  {
    num: "01",
    title: "Add your own info",
    body: "Share your name, grad year, and major once in My Info — every draft is written to sound like it's genuinely coming from you, not a template.",
  },
  {
    num: "02",
    title: "Tell it what you're after",
    body: "Pick a purpose — an informational interview, a referral, or just staying in touch — and add a note on what you'd like to learn or connect on. The AI turns that into a personalized, ready-to-edit draft.",
  },
];

export default function Landing({ chapterName, onSignIn }) {
  return (
    <div className="landing">
      <section className="landing-hero">
        <p className="landing-eyebrow">{chapterName || "Alpha Kappa Psi — Rho Chapter"} · Alumni &amp; Industry Network</p>
        <h1 className="landing-headline">
          The <em>Roster</em>
        </h1>
        <div className="hero-rule" />
        <p className="landing-sub">
          A shared directory of alumni, recruiters, and industry contacts, plus an outreach log for the chapter.
          Sign in to browse the roster, draft outreach emails, and keep your own progress saved to your account.
        </p>
        <div className="landing-cta-row">
          <button className="btn btn-brass landing-cta" onClick={onSignIn}>
            Sign in with Google
          </button>
        </div>
      </section>

      <hr className="landing-rule" />

      <section className="landing-stats">
        <div className="landing-stat">
          <span className="landing-stat-num">500+</span>
          <span className="landing-stat-label">Contacts on Record</span>
        </div>
        <div className="landing-stat">
          <span className="landing-stat-num">40</span>
          <span className="landing-stat-label">Years of Chapter History</span>
        </div>
        <div className="landing-stat">
          <span className="landing-stat-num">1</span>
          <span className="landing-stat-label">Shared Living Roster</span>
        </div>
      </section>

      <hr className="landing-rule" />

      <section className="landing-features">
        <div className="landing-container">
          <div className="section-label">
            <span>What's Inside</span>
          </div>
          <h2 className="landing-section-title">Built for staying in touch</h2>
          <p className="landing-section-sub">
            Everything the chapter needs to keep its alumni and industry network warm, in one shared place.
          </p>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.num}>
                <span className="feature-num">{f.num}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="landing-rule" />

      <section className="landing-features">
        <div className="landing-container">
          <div className="section-label">
            <span>How It Works</span>
          </div>
          <h2 className="landing-section-title">Make every email personal</h2>
          <p className="landing-section-sub">
            The draft assistant writes from your perspective, toward whatever you're actually hoping to get
            out of the conversation.
          </p>
          <div className="feature-grid how-it-works-grid">
            {HOW_IT_WORKS.map((f) => (
              <div className="feature-card" key={f.num}>
                <span className="feature-num">{f.num}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="landing-rule" />

      <footer className="landing-footer">{chapterName || "Alpha Kappa Psi — Rho Chapter"} · The Roster</footer>
    </div>
  );
}
