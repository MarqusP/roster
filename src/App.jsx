import { useEffect, useMemo, useState } from "react";
import { ToastProvider, useToast } from "./components/ToastProvider.jsx";
import Letterhead from "./components/Letterhead.jsx";
import StatStrip from "./components/StatStrip.jsx";
import Toolbar from "./components/Toolbar.jsx";
import RosterTable from "./components/RosterTable.jsx";
import ProfilePanel from "./components/ProfilePanel.jsx";
import ImportModal from "./components/ImportModal.jsx";
import MyInfoModal from "./components/MyInfoModal.jsx";
import { useAlumni } from "./hooks/useAlumni.js";
import { useSettings } from "./hooks/useSettings.js";
import { useLocalStorageState } from "./hooks/useLocalStorageState.js";
import { toCsv } from "./utils/csv.js";
import { firebaseReady } from "./firebase.js";

const STATUS_ORDER = { meeting: 0, replied: 1, contacted: 2, "not-contacted": 3 };
const STATUS_LABELS = {
  "not-contacted": "Not Contacted",
  contacted: "Contacted",
  replied: "Replied",
  meeting: "Meeting Scheduled",
};

function AppInner() {
  const showToast = useToast();
  const { alumni, loading, error, addAlumnus, importMany, clearAll } = useAlumni();
  const { chapterName, setChapterName } = useSettings();
  const [outreachLog, setOutreachLog] = useLocalStorageState("roster-outreach-log-v1", {});
  const [myInfo, setMyInfo] = useLocalStorageState("roster-my-info-v1", { name: "", gradYear: "", major: "" });

  const [filters, setFilters] = useState({ query: "", industry: "all", status: "all", sort: "name" });
  const [panelId, setPanelId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [myInfoOpen, setMyInfoOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setPanelId(null);
        setImportOpen(false);
        setMyInfoOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function statusOf(id) {
    return (outreachLog[id] && outreachLog[id].status) || "not-contacted";
  }

  const industries = useMemo(
    () => Array.from(new Set(alumni.map((a) => (a.industry || "").trim()).filter(Boolean))).sort(),
    [alumni]
  );

  const filtered = useMemo(() => {
    let list = alumni.slice();
    const q = filters.query.trim().toLowerCase();
    if (q) {
      list = list.filter((a) =>
        [a.name, a.company, a.title, a.location, a.industry].join(" ").toLowerCase().includes(q)
      );
    }
    if (filters.industry !== "all") {
      list = list.filter((a) => (a.industry || "").trim() === filters.industry);
    }
    if (filters.status !== "all") {
      list = list.filter((a) => statusOf(a.id) === filters.status);
    }
    list.sort((a, b) => {
      switch (filters.sort) {
        case "company":
          return (a.company || "").localeCompare(b.company || "");
        case "industry":
          return (a.industry || "").localeCompare(b.industry || "");
        case "status":
          return STATUS_ORDER[statusOf(a.id)] - STATUS_ORDER[statusOf(b.id)];
        case "recent":
          return (b.seq || 0) - (a.seq || 0);
        default:
          return (a.name || "").localeCompare(b.name || "");
      }
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumni, filters, outreachLog]);

  const panelAlum = alumni.find((a) => a.id === panelId) || null;

  function saveStatus(id, status, notes) {
    const now = new Date().toISOString().slice(0, 10);
    setOutreachLog((prev) => {
      const prevEntry = prev[id] || { history: [] };
      const entry = {
        status,
        notes,
        lastContactedDate: status !== "not-contacted" ? now : prevEntry.lastContactedDate || "",
        history: (prevEntry.history || []).concat([{ date: now, status, by: myInfo.name || "You" }]),
      };
      return { ...prev, [id]: entry };
    });
    showToast("Status saved.");
  }

  function handleExport() {
    if (alumni.length === 0) {
      showToast("Nothing to export yet.", "error");
      return;
    }
    const csv = toCsv(alumni, outreachLog, (s) => STATUS_LABELS[s] || "Not Contacted");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alumni-roster-export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Roster exported.");
  }

  if (!firebaseReady) {
    return (
      <div style={{ padding: 40, maxWidth: 640, margin: "0 auto", color: "#F3ECD9" }}>
        <h1 style={{ fontFamily: "var(--font-display)" }}>Firebase isn't configured yet</h1>
        <p>
          Add your Firebase project credentials to a <code>.env</code> file (see <code>.env.example</code>) and
          restart the dev server to connect the shared roster.
        </p>
      </div>
    );
  }

  const anyOverlayOpen = Boolean(panelId) || importOpen || myInfoOpen;

  return (
    <>
      <Letterhead
        chapterName={chapterName}
        onChapterNameChange={setChapterName}
        onOpenMyInfo={() => setMyInfoOpen(true)}
        onExport={handleExport}
        onOpenAdd={() => setImportOpen(true)}
      />

      {!myInfo.name && (
        <div className="helper-banner">
          <span>Add your name so drafted emails sound like they're from you.</span>
          <button className="btn btn-sm btn-brass" onClick={() => setMyInfoOpen(true)}>Add my info</button>
        </div>
      )}

      <StatStrip alumni={alumni} statusOf={statusOf} />
      <Toolbar filters={filters} onChange={setFilters} industries={industries} />

      <main>
        {loading ? (
          <p style={{ color: "#C9C0A6" }}>Loading the roster…</p>
        ) : (
          <RosterTable
            alumni={alumni}
            filtered={filtered}
            statusOf={statusOf}
            onOpen={setPanelId}
            onAddClick={() => setImportOpen(true)}
          />
        )}
        {error && <p style={{ color: "#E9C6C0" }}>Couldn't load the roster: {error}</p>}
      </main>

      <div
        className={`overlay${anyOverlayOpen ? " visible" : ""}`}
        onClick={() => {
          setPanelId(null);
          setImportOpen(false);
          setMyInfoOpen(false);
        }}
      />

      <ProfilePanel
        alum={panelAlum}
        entry={panelAlum ? outreachLog[panelAlum.id] : null}
        myInfo={myInfo}
        chapterName={chapterName}
        open={Boolean(panelId)}
        onClose={() => setPanelId(null)}
        onSaveStatus={saveStatus}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={importMany}
        onManualAdd={addAlumnus}
        onClearAll={clearAll}
      />

      <MyInfoModal open={myInfoOpen} myInfo={myInfo} onSave={setMyInfo} onClose={() => setMyInfoOpen(false)} />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
