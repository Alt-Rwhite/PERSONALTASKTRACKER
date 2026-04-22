import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://djrdgxrhwstbltbkmjpv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqcmRneHJod3N0Ymx0YmttanB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyOTc5OTcsImV4cCI6MjA5MDg3Mzk5N30.Kx5Wc2MfMXto-rn1Vq5AgsdBzGVUItFjFirkdpNNgVU";
const APP_URL = "https://alt-rwhite.github.io/PERSONALTASKTRACKER/";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SC = {
  open:       { label: "Open",        dot: "#555",    bg: "#1a1a1a", color: "#fff", border: "#444" },
  inprogress: { label: "In Progress", dot: "#ffffff", bg: "#ffffff", color: "#000", border: "#fff" },
  onhold:     { label: "On Hold",     dot: "#555",    bg: "#1e1e1e", color: "#888", border: "#444" },
  closed:     { label: "Closed",      dot: "#1e1e1e", bg: "#0d0d0d", color: "#333", border: "#1a1a1a" },
};

const fmt = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};
const fmtShort = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Hl({ text, q }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return <>{text}</>;
  return <>{text.slice(0, i)}<mark style={{ background: "#fff", color: "#000", padding: "0 1px" }}>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

const PB = { background: "#fff", color: "#000", border: "none", padding: "7px 16px", fontSize: 10, letterSpacing: 2, fontFamily: "'DM Mono',monospace", cursor: "pointer" };
const GB = { background: "transparent", color: "#555", border: "1px solid #1e1e1e", padding: "7px 16px", fontSize: 10, letterSpacing: 2, fontFamily: "'DM Mono',monospace", cursor: "pointer" };

export default function App() {
  const [session, setSession] = useState(undefined);
  const [tasks, setTasks]     = useState([]);
  const [view, setView]       = useState("list");
  const [active, setActive]   = useState(null);
  const [notes, setNotes]     = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding]   = useState(false);
  const [filter, setFilter]   = useState("all");
  const [sort, setSort]       = useState("desc");
  const [search, setSearch]   = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const taRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) loadTasks(); }, [session]);

  const loadTasks = async () => {
    setDbLoading(true);
    const { data } = await supabase.from("tasks").select("*").eq("user_id", session.user.id);
    setTasks(data || []);
    setDbLoading(false);
  };

  const doMagicLink = async () => {
    if (!email.trim()) return;
    setAuthBusy(true); setAuthErr("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: APP_URL },
    });
    setAuthBusy(false);
    if (error) setAuthErr(error.message);
    else setSent(true);
  };

  const doSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null); setTasks([]); setView("list");
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
    if (data) setNotes(p => [...p, data]);
    setNoteInput("");
  };

  const statusCounts = Object.keys(SC).reduce((a, s) => ({ ...a, [s]: tasks.filter(t => t.status === s).length }), {});
  const list = tasks
    .filter(t => filter === "all" || t.status === filter)
    .filter(t => !search.trim() || t.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === "desc"
      ? new Date(b.created_at) - new Date(a.created_at)
      : new Date(a.created_at) - new Date(b.created_at));

  if (session === undefined) return (
    <Shell><Center><span style={{ fontSize: 11, color: "#222", letterSpacing: 4 }}>LOADING...</span></Center></Shell>
  );

  if (!session) return (
    <Shell>
      <div style={{ maxWidth: 400, margin: "0 auto", padding: "80px 24px" }}>
        <Logo />
        <div style={{ marginTop: 48 }}>
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.6 }}>✉</div>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.8 }}>
                Magic link sent to<br /><span style={{ color: "#ddd" }}>{email}</span>
              </p>
              <p style={{ fontSize: 11, color: "#333", marginTop: 12, lineHeight: 1.7 }}>Check your inbox and click the link immediately.</p>
              <button onClick={() => { setSent(false); setEmail(""); }} style={{ ...GB, marginTop: 24 }}>USE DIFFERENT EMAIL</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 10, color: "#444", letterSpacing: 2, marginBottom: 16 }}>SIGN IN — NO PASSWORD NEEDED</div>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doMagicLink()}
                placeholder="your@email.com"
                style={{ width: "100%", background: "#0a0a0a", border: "1px solid #1a1a1a", color: "#eee", fontSize: 13, padding: "11px 14px", fontFamily: "'DM Mono',monospace", marginBottom: 10 }}
              />
              {authErr && <div style={{ fontSize: 11, color: "#c44", marginBottom: 10 }}>{authErr}</div>}
              <button onClick={doMagicLink} disabled={authBusy} style={{ ...PB, width: "100%", padding: "10px 0" }}>
                {authBusy ? "SENDING..." : "SEND MAGIC LINK →"}
              </button>
              <p style={{ fontSize: 11, color: "#2a2a2a", marginTop: 16, lineHeight: 1.7 }}>We'll email you a one-click sign-in link. No password ever.</p>
            </>
          )}
        </div>
      </div>
    </Shell>
  );

  const curTask = tasks.find(t => t.id === active?.id) || active;

  return (
    <Shell>
      <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #141414", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          {view === "detail" && (
            <span onClick={() => { setView("list"); setActive(null); }}
              style={{ fontSize: 11, color: "#444", cursor: "pointer", letterSpacing: 1, marginRight: 6 }}
              onMouseEnter={e => e.target.style.color = "#aaa"}
              onMouseLeave={e => e.target.style.color = "#444"}>
              ← back
            </span>
          )}
          <Logo inline />
          {view === "list" && <span style={{ fontSize: 10, color: "#282828", letterSpacing: 2 }}>{tasks.length} TASKS</span>}
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {view === "list" && (
            <button onClick={() => { setAdding(true); setTimeout(() => taRef.current?.focus(), 40); }} style={PB}>+ NEW</button>
          )}
          <span style={{ fontSize: 10, color: "#2e2e2e" }}>{session.user.email}</span>
          <span onClick={doSignOut}
            style={{ fontSize: 10, color: "#333", cursor: "pointer", letterSpacing: 1 }}
            onMouseEnter={e => e.target.style.color = "#888"}
            onMouseLeave={e => e.target.style.color = "#333"}>
            sign out
          </span>
        </div>
      </div>

      {view === "list" && (
        <>
          <div style={{ display: "flex", borderBottom: "1px solid #111" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", position: "relative" }}>
              <span style={{ position: "absolute", left: 14, color: "#2e2e2e", fontSize: 14, pointerEvents: "none" }}>⌕</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search tasks and notes..."
                style={{ width: "100%", background: "transparent", border: "none", borderRight: "1px solid #111", color: "#bbb", fontSize: 12, padding: "10px 14px 10px 34px", fontFamily: "'DM Mono',monospace" }}
              />
            </div>
            <button onClick={() => setSort(s => s === "desc" ? "asc" : "desc")}
              style={{ ...GB, border: "none", color: "#383838", padding: "0 18px", whiteSpace: "nowrap", fontSize: 10 }}>
              DATE {sort === "desc" ? "↓" : "↑"}
            </button>
          </div>

          <div style={{ display: "flex", borderBottom: "1px solid #0e0e0e", overflowX: "auto" }}>
            {[["all", "All", tasks.length], ...Object.entries(SC).map(([k, v]) => [k, v.label, statusCounts[k]])].map(([k, l, c]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                background: filter === k ? "#111" : "transparent",
                color: filter === k ? "#ddd" : "#2e2e2e",
                border: "none", borderBottom: filter === k ? "2px solid #eee" : "2px solid transparent",
                padding: "9px 16px", fontSize: 10, letterSpacing: 1.5,
                fontFamily: "'DM Mono',monospace", cursor: "pointer", whiteSpace: "nowrap",
              }}>
                {String(l).toUpperCase()} <span style={{ opacity: 0.4 }}>({c})</span>
              </button>
            ))}
          </div>

          {adding && (
            <div style={{ margin: "14px 22px", border: "1px solid #1a1a1a", background: "#0c0c0c", padding: 18 }}>
              <div style={{ fontSize: 10, color: "#383838", letterSpacing: 2, marginBottom: 10 }}>NEW TASK</div>
              <textarea ref={taRef} value={newDesc} onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doAddTask(); }
                  if (e.key === "Escape") { setAdding(false); setNewDesc(""); }
                }}
                placeholder="Describe the task… (Enter to save, Esc to cancel)"
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #1a1a1a", color: "#ddd", fontSize: 13, padding: "6px 0", resize: "none", minHeight: 54, lineHeight: 1.6, fontFamily: "'DM Mono',monospace" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={doAddTask} style={PB}>SAVE</button>
                <button onClick={() => { setAdding(false); setNewDesc(""); }} style={GB}>CANCEL</button>
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto" }}>
            {dbLoading
              ? <Center><span style={{ fontSize: 10, color: "#1e1e1e", letterSpacing: 3 }}>LOADING...</span></Center>
              : list.length === 0
                ? <Center><span style={{ fontSize: 10, color: "#1e1e1e", letterSpacing: 2 }}>{search ? `NO RESULTS FOR "${search.toUpperCase()}"` : "NO TASKS YET"}</span></Center>
                : list.map(task => {
                  const s = SC[task.status];
                  return (
                    <div key={task.id} onClick={() => doOpenTask(task)}
                      style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "15px 22px", borderBottom: "1px solid #0d0d0d", cursor: "pointer", transition: "background 0.1s, transform 0.1s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#111"; e.currentTarget.style.transform = "translateX(3px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "none"; }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, border: "1px solid #1e1e1e", marginTop: 7, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: task.status === "closed" ? "#2e2e2e" : "#ccc", textDecoration: task.status === "closed" ? "line-through" : "none", lineHeight: 1.55, marginBottom: 4 }}>
                          <Hl text={task.description} q={search} />
                        </div>
                        <div style={{ fontSize: 10, color: "#222", letterSpacing: 1 }}>{fmtShort(task.created_at)}</div>
                      </div>
                      <span style={{ fontSize: 9, letterSpacing: 1.5, padding: "3px 10px", background: s.bg, color: s.color, border: `1px solid ${s.border}`, flexShrink: 0, alignSelf: "center" }}>
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
          <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid #141414" }}>
            <div style={{ fontSize: 10, color: "#282828", letterSpacing: 2, marginBottom: 8 }}>ADDED {fmt(curTask.created_at)}</div>
            <div style={{ fontSize: 15, color: "#e0e0e0", lineHeight: 1.65, marginBottom: 22 }}>{curTask.description}</div>
            <div style={{ fontSize: 10, color: "#383838", letterSpacing: 2, marginBottom: 10 }}>STATUS</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {Object.entries(SC).map(([key, cfg]) => {
                const on = curTask.status === key;
                return (
                  <button key={key} onClick={() => doUpdateStatus(curTask.id, key)}
                    style={{ background: on ? cfg.bg : "transparent", color: on ? cfg.color : "#2e2e2e", border: `1px solid ${on ? cfg.border : "#1a1a1a"}`, padding: "5px 14px", fontSize: 9, letterSpacing: 1.5, fontFamily: "'DM Mono',monospace", cursor: "pointer", transition: "all 0.1s" }}>
                    {cfg.label.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ flex: 1, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 10, color: "#383838", letterSpacing: 2 }}>NOTES {notes.length > 0 ? `(${notes.length})` : ""}</div>
            <div style={{ border: "1px solid #141414", background: "#0b0b0b" }}>
              <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doAddNote(); } }}
                placeholder="Add a note… (Enter to save, Shift+Enter for new line)"
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #141414", color: "#ccc", fontSize: 12, padding: "12px 14px", resize: "none", minHeight: 70, lineHeight: 1.7, fontFamily: "'DM Mono',monospace" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 12px" }}>
                <button onClick={doAddNote} style={{ ...PB, fontSize: 9 }}>SAVE NOTE</button>
              </div>
            </div>
            {notes.length === 0
              ? <div style={{ fontSize: 11, color: "#1a1a1a", letterSpacing: 1 }}>NO NOTES YET</div>
              : [...notes].reverse().map(n => (
                <div key={n.id} style={{ paddingBottom: 14, borderBottom: "1px solid #0e0e0e" }}>
                  <div style={{ fontSize: 10, color: "#252525", letterSpacing: 1, marginBottom: 6 }}>{fmt(n.created_at)}</div>
                  <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.65 }}>
                    <Hl text={n.body} q={search} />
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

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#f0f0f0", fontFamily: "'DM Mono','Courier New',monospace", display: "flex", flexDirection: "column", maxWidth: 700, margin: "0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:#080808;}::-webkit-scrollbar-thumb{background:#1e1e1e;}
        textarea,input{outline:none;}
        mark{border-radius:1px;}
      `}</style>
      {children}
    </div>
  );
}

function Logo({ inline }) {
  return <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: inline ? 21 : 30, letterSpacing: 4, color: "#fff" }}>TASKBOARD</span>;
}

function Center({ children }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 20px" }}>{children}</div>;
}
