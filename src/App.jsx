import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://djrdgxrhwstbltbkmjpv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqcmRneHJod3N0Ymx0YmttanB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyOTc5OTcsImV4cCI6MjA5MDg3Mzk5N30.Kx5Wc2MfMXto-rn1Vq5AgsdBzGVUItFjFirkdpNNgVU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── THEMES ───────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg: "#000",
    panel: "#0c0c0c",
    panel2: "#111",
    panel3: "#141414",
    border: "#222",
    border2: "#2a2a2a",
    border3: "#1a1a1a",
    text: "#fff",
    textDim: "#aaa",
    textDim2: "#888",
    textDim3: "#666",
    textFaint: "#555",
    accent: "#fff",
    accentText: "#000",
    inputBg: "#111",
    hoverBg: "#141414",
    scrollTrack: "#000",
    scrollThumb: "#333",
    inputPlaceholder: "#555",
    markBg: "#fff",
    markColor: "#000",
    SC: {
      open:       { label: "Open",        dot: "#888",    bg: "#1a1a1a", color: "#fff", border: "#555" },
      inprogress: { label: "In Progress", dot: "#ffffff", bg: "#ffffff", color: "#000", border: "#fff" },
      onhold:     { label: "On Hold",     dot: "#888",    bg: "#222",    color: "#ccc", border: "#555" },
      closed:     { label: "Closed",      dot: "#444",    bg: "#141414", color: "#666", border: "#333" },
    },
  },
  light: {
    bg: "#fff",
    panel: "#f8f8f8",
    panel2: "#f0f0f0",
    panel3: "#ececec",
    border: "#ddd",
    border2: "#ccc",
    border3: "#e5e5e5",
    text: "#000",
    textDim: "#444",
    textDim2: "#666",
    textDim3: "#888",
    textFaint: "#aaa",
    accent: "#000",
    accentText: "#fff",
    inputBg: "#f5f5f5",
    hoverBg: "#f0f0f0",
    scrollTrack: "#fff",
    scrollThumb: "#ccc",
    inputPlaceholder: "#aaa",
    markBg: "#000",
    markColor: "#fff",
    SC: {
      open:       { label: "Open",        dot: "#666",    bg: "#e5e5e5", color: "#000", border: "#aaa" },
      inprogress: { label: "In Progress", dot: "#000000", bg: "#000000", color: "#fff", border: "#000" },
      onhold:     { label: "On Hold",     dot: "#666",    bg: "#dcdcdc", color: "#333", border: "#aaa" },
      closed:     { label: "Closed",      dot: "#bbb",    bg: "#f0f0f0", color: "#999", border: "#ddd" },
    },
  },
};

const fmt = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};
const fmtShort = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Hl({ text, q, T }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return <>{text}</>;
  return <>{text.slice(0, i)}<mark style={{ background: T.markBg, color: T.markColor, padding: "0 2px" }}>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("tb_theme") || "dark");
  const T = THEMES[theme];
  const SC = T.SC;

  const [session, setSession] = useState(undefined);
  const [tasks, setTasks]     = useState([]);
  const [latestNotes, setLatestNotes] = useState({});
  const [view, setView]       = useState("list");
  const [active, setActive]   = useState(null);
  const [notes, setNotes]     = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding]   = useState(false);
  const [filter, setFilter]   = useState("active");
  const [sort, setSort]       = useState("desc");
  const [search, setSearch]   = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const taRef = useRef(null);

  const PB = { background: T.accent, color: T.accentText, border: "none", padding: "9px 18px", fontSize: 11, letterSpacing: 2, fontFamily: "'DM Mono',monospace", fontWeight: 600, cursor: "pointer" };
  const GB = { background: "transparent", color: T.textDim, border: `1px solid ${T.border2}`, padding: "9px 18px", fontSize: 11, letterSpacing: 2, fontFamily: "'DM Mono',monospace", fontWeight: 500, cursor: "pointer" };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("tb_theme", next);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) loadAll(); }, [session]);

  const loadAll = async () => {
    setDbLoading(true);
    const { data: taskData } = await supabase.from("tasks").select("*").eq("user_id", session.user.id);
    setTasks(taskData || []);
    const { data: noteData } = await supabase
      .from("task_notes")
      .select("task_id,body,created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    const latest = {};
    (noteData || []).forEach(n => {
      if (!latest[n.task_id]) latest[n.task_id] = n;
    });
    setLatestNotes(latest);
    setDbLoading(false);
  };

  const doSignIn = async () => {
    if (!email.trim() || !password) return;
    setAuthBusy(true); setAuthErr("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setAuthBusy(false);
    if (error) setAuthErr(error.message);
  };

  const doSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null); setTasks([]); setLatestNotes({}); setView("list");
  };

  const doAddTask = async () => {
    if (!newDesc.trim()) return;
    const { data } = await supabase.from("tasks").insert({
      user_id: session.user.id,
      description: newDesc.trim(),
      status: "open",
    }).select().single();
    if (data) setTasks(p => [data, ...p]);
    setNewDesc(""); setAdding(false);
  };

  const doUpdateStatus = async (id, status) => {
    await supabase.from("tasks").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setTasks(p => p.map(t => t.id === id ? { ...t, status } : t));
    if (active?.id === id) setActive(p => ({ ...p, status }));
  };

  const doOpenTask = async (task) => {
    setActive(task); setView("detail"); setNoteInput("");
    const { data } = await supabase.from("task_notes").select("*").eq("task_id", task.id).order("created_at", { ascending: true });
    setNotes(data || []);
  };

  const doAddNote = async () => {
    if (!noteInput.trim()) return;
    const { data } = await supabase.from("task_notes").insert({
      task_id: active.id,
      user_id: session.user.id,
      body: noteInput.trim(),
    }).select().single();
    if (data) {
      setNotes(p => [...p, data]);
      setLatestNotes(p => ({ ...p, [active.id]: { task_id: active.id, body: data.body, created_at: data.created_at } }));
    }
    setNoteInput("");
  };

  const statusCounts = Object.keys(SC).reduce((a, s) => ({ ...a, [s]: tasks.filter(t => t.status === s).length }), {});
  const activeCount = tasks.filter(t => t.status !== "closed").length;
  const list = tasks
    .filter(t => filter === "active" ? t.status !== "closed" : t.status === filter)
    .filter(t => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      if (t.description.toLowerCase().includes(q)) return true;
      const note = latestNotes[t.id];
      return note && note.body.toLowerCase().includes(q);
    })
    .sort((a, b) => sort === "desc"
      ? new Date(b.created_at) - new Date(a.created_at)
      : new Date(a.created_at) - new Date(b.created_at));

  const ThemeBtn = () => (
    <span onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      style={{ fontSize: 14, color: T.textDim2, cursor: "pointer", userSelect: "none", lineHeight: 1 }}>
      {theme === "dark" ? "☀" : "☾"}
    </span>
  );

  if (session === undefined) return (
    <Shell T={T}><Center><span style={{ fontSize: 12, color: T.textFaint, letterSpacing: 4 }}>LOADING...</span></Center></Shell>
  );

  if (!session) return (
    <Shell T={T}>
      <div style={{ maxWidth: 400, margin: "0 auto", padding: "80px 24px", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 48 }}>
          <Logo T={T} />
          <ThemeBtn />
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.textDim2, letterSpacing: 2, marginBottom: 20, fontWeight: 500 }}>SIGN IN</div>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSignIn()}
            placeholder="your@email.com"
            style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border2}`, color: T.text, fontSize: 14, padding: "13px 16px", fontFamily: "'DM Mono',monospace", marginBottom: 10, fontWeight: 500 }}
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSignIn()}
            placeholder="password"
            style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.border2}`, color: T.text, fontSize: 14, padding: "13px 16px", fontFamily: "'DM Mono',monospace", marginBottom: 10, fontWeight: 500 }}
          />
          {authErr && <div style={{ fontSize: 12, color: "#d33", marginBottom: 10, fontWeight: 500 }}>{authErr}</div>}
          <button onClick={doSignIn} disabled={authBusy} style={{ ...PB, width: "100%", padding: "12px 0", fontSize: 12 }}>
            {authBusy ? "SIGNING IN..." : "SIGN IN →"}
          </button>
        </div>
      </div>
    </Shell>
  );

  const curTask = tasks.find(t => t.id === active?.id) || active;

  return (
    <Shell T={T}>
      <div style={{ padding: "16px 18px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          {view === "detail" && (
            <span onClick={() => { setView("list"); setActive(null); }}
              style={{ fontSize: 12, color: T.textDim, cursor: "pointer", letterSpacing: 1, marginRight: 4, fontWeight: 500 }}>
              ← back
            </span>
          )}
          <Logo inline T={T} />
          {view === "list" && <span style={{ fontSize: 11, color: T.textDim3, letterSpacing: 2, fontWeight: 500 }}>{tasks.length} TASKS</span>}
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {view === "list" && (
            <button onClick={() => { setAdding(true); setTimeout(() => taRef.current?.focus(), 40); }} style={PB}>+ NEW</button>
          )}
          <ThemeBtn />
          <span onClick={doSignOut}
            style={{ fontSize: 11, color: T.textDim2, cursor: "pointer", letterSpacing: 1, fontWeight: 500 }}>
            sign out
          </span>
        </div>
      </div>

      {view === "list" && (
        <>
          <div style={{ display: "flex", borderBottom: `1px solid ${T.border3}` }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", position: "relative" }}>
              <span style={{ position: "absolute", left: 14, color: T.textDim3, fontSize: 16, pointerEvents: "none" }}>⌕</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search tasks and notes..."
                style={{ width: "100%", background: "transparent", border: "none", borderRight: `1px solid ${T.border3}`, color: T.text, fontSize: 13, padding: "12px 14px 12px 36px", fontFamily: "'DM Mono',monospace", fontWeight: 500 }}
              />
            </div>
            <button onClick={() => setSort(s => s === "desc" ? "asc" : "desc")}
              style={{ background: "transparent", border: "none", color: T.textDim, padding: "0 18px", whiteSpace: "nowrap", fontSize: 11, letterSpacing: 1, fontFamily: "'DM Mono',monospace", cursor: "pointer", fontWeight: 500 }}>
              DATE {sort === "desc" ? "↓" : "↑"}
            </button>
          </div>

          <div style={{ display: "flex", borderBottom: `1px solid ${T.border3}`, overflowX: "auto" }}>
            {[["active", "Active", activeCount], ...Object.entries(SC).map(([k, v]) => [k, v.label, statusCounts[k]])].map(([k, l, c]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                background: filter === k ? T.panel3 : "transparent",
                color: filter === k ? T.text : T.textDim2,
                border: "none", borderBottom: filter === k ? `2px solid ${T.accent}` : "2px solid transparent",
                padding: "11px 16px", fontSize: 11, letterSpacing: 1.5,
                fontFamily: "'DM Mono',monospace", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500,
              }}>
                {String(l).toUpperCase()} <span style={{ opacity: 0.6 }}>({c})</span>
              </button>
            ))}
          </div>

          {adding && (
            <div style={{ margin: "14px 18px", border: `1px solid ${T.border2}`, background: T.panel2, padding: 16 }}>
              <div style={{ fontSize: 11, color: T.textDim2, letterSpacing: 2, marginBottom: 10, fontWeight: 500 }}>NEW TASK</div>
              <textarea ref={taRef} value={newDesc} onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doAddTask(); }
                  if (e.key === "Escape") { setAdding(false); setNewDesc(""); }
                }}
                placeholder="Describe the task… (Enter to save, Esc to cancel)"
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${T.border2}`, color: T.text, fontSize: 14, padding: "8px 0", resize: "none", minHeight: 56, lineHeight: 1.6, fontFamily: "'DM Mono',monospace", fontWeight: 500 }} />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={doAddTask} style={PB}>SAVE</button>
                <button onClick={() => { setAdding(false); setNewDesc(""); }} style={GB}>CANCEL</button>
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto" }}>
            {dbLoading
              ? <Center><span style={{ fontSize: 11, color: T.textFaint, letterSpacing: 3 }}>LOADING...</span></Center>
              : list.length === 0
                ? <Center><span style={{ fontSize: 11, color: T.textFaint, letterSpacing: 2 }}>{search ? `NO RESULTS FOR "${search.toUpperCase()}"` : "NO TASKS YET"}</span></Center>
                : list.map(task => {
                  const s = SC[task.status];
                  const latest = latestNotes[task.id];
                  return (
                    <div key={task.id} onClick={() => doOpenTask(task)}
                      style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${T.border3}`, cursor: "pointer", transition: "background 0.1s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = T.hoverBg; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot, marginTop: 7, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: task.status === "closed" ? T.textDim3 : T.text, textDecoration: task.status === "closed" ? "line-through" : "none", lineHeight: 1.5, marginBottom: 5, fontWeight: 500, wordBreak: "break-word" }}>
                          <Hl text={task.description} q={search} T={T} />
                        </div>
                        <div style={{ fontSize: 11, color: T.textDim3, letterSpacing: 1, fontWeight: 500, marginBottom: latest ? 8 : 0 }}>{fmtShort(task.created_at)}</div>
                        {latest && (
                          <div
                            onClick={e => e.stopPropagation()}
                            style={{
                              maxHeight: 60,
                              overflowY: "auto",
                              background: T.panel,
                              border: `1px solid ${T.border3}`,
                              borderLeft: `2px solid ${T.border2}`,
                              padding: "6px 10px",
                              fontSize: 12,
                              color: T.textDim,
                              lineHeight: 1.5,
                              fontWeight: 500,
                              wordBreak: "break-word",
                              cursor: "text",
                            }}
                          >
                            <div style={{ fontSize: 9, color: T.textFaint, letterSpacing: 1, marginBottom: 3, fontWeight: 600 }}>
                              LAST NOTE · {fmtShort(latest.created_at)}
                            </div>
                            <Hl text={latest.body} q={search} T={T} />
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 10, letterSpacing: 1.5, padding: "4px 10px", background: s.bg, color: s.color, border: `1px solid ${s.border}`, flexShrink: 0, alignSelf: "flex-start", fontWeight: 600 }}>
                        {s.label.toUpperCase()}
                      </span>
                    </div>
                  );
                })
            }
          </div>
        </>
      )}

      {view === "detail" && curTask && (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "22px 18px 18px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.textDim2, letterSpacing: 2, marginBottom: 10, fontWeight: 500 }}>ADDED {fmt(curTask.created_at)}</div>
            <div style={{ fontSize: 16, color: T.text, lineHeight: 1.6, marginBottom: 22, fontWeight: 500, wordBreak: "break-word" }}>{curTask.description}</div>
            <div style={{ fontSize: 11, color: T.textDim2, letterSpacing: 2, marginBottom: 10, fontWeight: 500 }}>STATUS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {Object.entries(SC).map(([key, cfg]) => {
                const on = curTask.status === key;
                return (
                  <button key={key} onClick={() => doUpdateStatus(curTask.id, key)}
                    style={{
                      background: on ? cfg.bg : "transparent",
                      color: on ? cfg.color : T.textDim2,
                      border: `1px solid ${on ? cfg.border : T.border2}`,
                      padding: "10px 14px",
                      fontSize: 11,
                      letterSpacing: 1.5,
                      fontFamily: "'DM Mono',monospace",
                      cursor: "pointer",
                      transition: "all 0.1s",
                      fontWeight: 600,
                      textAlign: "center",
                      width: "100%",
                    }}>
                    {cfg.label.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ flex: 1, padding: "20px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 11, color: T.textDim2, letterSpacing: 2, fontWeight: 500 }}>NOTES {notes.length > 0 ? `(${notes.length})` : ""}</div>
            <div style={{ border: `1px solid ${T.border2}`, background: T.panel2 }}>
              <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doAddNote(); } }}
                placeholder="Add a note… (Enter to save, Shift+Enter for new line)"
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${T.border2}`, color: T.text, fontSize: 13, padding: "14px 14px", resize: "none", minHeight: 72, lineHeight: 1.7, fontFamily: "'DM Mono',monospace", fontWeight: 500 }} />
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 10px" }}>
                <button onClick={doAddNote} style={{ ...PB, fontSize: 10, padding: "7px 14px" }}>SAVE NOTE</button>
              </div>
            </div>
            {notes.length === 0
              ? <div style={{ fontSize: 12, color: T.textFaint, letterSpacing: 1, fontWeight: 500 }}>NO NOTES YET</div>
              : [...notes].reverse().map(n => (
                <div key={n.id} style={{ paddingBottom: 14, borderBottom: `1px solid ${T.border3}` }}>
                  <div style={{ fontSize: 11, color: T.textDim3, letterSpacing: 1, marginBottom: 7, fontWeight: 500 }}>{fmt(n.created_at)}</div>
                  <div style={{ fontSize: 14, color: T.textDim, lineHeight: 1.65, fontWeight: 500, wordBreak: "break-word" }}>
                    <Hl text={n.body} q={search} T={T} />
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, T }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{background:${T.bg};min-height:100vh;width:100%;}
        body{overflow-x:hidden;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:${T.scrollTrack};}
        ::-webkit-scrollbar-thumb{background:${T.scrollThumb};}
        textarea,input{outline:none;}
        input::placeholder,textarea::placeholder{color:${T.inputPlaceholder};}
        mark{border-radius:1px;}
      `}</style>
      <div style={{ background: T.bg, minHeight: "100vh", width: "100%" }}>
        <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Mono','Courier New',monospace", fontWeight: 500, display: "flex", flexDirection: "column", maxWidth: 760, margin: "0 auto" }}>
          {children}
        </div>
      </div>
    </>
  );
}

function Logo({ inline, T }) {
  return <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: inline ? 24 : 34, letterSpacing: 4, color: T.text }}>TASKBOARD</span>;
}

function Center({ children }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 20px" }}>{children}</div>;
}
