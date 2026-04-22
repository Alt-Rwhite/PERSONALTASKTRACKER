import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://djrdgxrhwstbltbkmjpv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqcmRneHJod3N0Ymx0YmttanB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyOTc5OTcsImV4cCI6MjA5MDg3Mzk5N30.Kx5Wc2MfMXto-rn1Vq5AgsdBzGVUItFjFirkdpNNgVU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SC = {
  open:       { label: "Open",        dot: "#888",    bg: "#1a1a1a", color: "#fff", border: "#555" },
  inprogress: { label: "In Progress", dot: "#ffffff", bg: "#ffffff", color: "#000", border: "#fff" },
  onhold:     { label: "On Hold",     dot: "#888",    bg: "#222",    color: "#ccc", border: "#555" },
  closed:     { label: "Closed",      dot: "#444",    bg: "#141414", color: "#666", border: "#333" },
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
  return <>{text.slice(0, i)}<mark style={{ background: "#fff", color: "#000", padding: "0 2px" }}>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

const PB = { background: "#fff", color: "#000", border: "none", padding: "9px 18px", fontSize: 11, letterSpacing: 2, fontFamily: "'DM Mono',monospace", fontWeight: 600, cursor: "pointer" };
const GB = { background: "transparent", color: "#aaa", border: "1px solid #333", padding: "9px 18px", fontSize: 11, letterSpacing: 2, fontFamily: "'DM Mono',monospace", fontWeight: 500, cursor: "pointer" };

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
  const [password, setPassword] = useState("");
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
    <Shell><Center><span style={{ fontSize: 12, color: "#555", letterSpacing: 4 }}>LOADING...</span></Center></Shell>
  );

  if (!session) return (
    <Shell>
      <div style={{ maxWidth: 400, margin: "0 auto", padding: "80px 24px", width: "100%" }}>
        <Logo />
        <div style={{ marginTop: 48 }}>
          <div style={{ fontSize: 11, color: "#888", letterSpacing: 2, marginBottom: 20, fontWeight: 500 }}>SIGN IN</div>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSignIn()}
            placeholder="your@email.com"
            style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", color: "#fff", fontSize: 14, padding: "13px 16px", fontFamily: "'DM Mono',monospace", marginBottom: 10, fontWeight: 500 }}
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSignIn()}
            placeholder="password"
            style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", color: "#fff", fontSize: 14, padding: "13px 16px", fontFamily: "'DM Mono',monospace", marginBottom: 10, fontWeight: 500 }}
          />
          {authErr && <div style={{ fontSize: 12, color: "#ff6464", marginBottom: 10, fontWeight: 500 }}>{authErr}</div>}
          <button onClick={doSignIn} disabled={authBusy} style={{ ...PB, width: "100%", padding: "12px 0", fontSize: 12 }}>
            {authBusy ? "SIGNING IN..." : "SIGN IN →"}
          </button>
        </div>
      </div>
    </Shell>
  );

  const curTask = tasks.find(t => t.id === active?.id) || active;

  return (
    <Shell>
      <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          {view === "detail" && (
            <span onClick={() => { setView("list"); setActive(null); }}
              style={{ fontSize: 12, color: "#999", cursor: "pointer", letterSpacing: 1, marginRight: 4, fontWeight: 500 }}>
              ← back
            </span>
          )}
          <Logo inline />
          {view === "list" && <span style={{ fontSize: 11, color: "#666", letterSpacing: 2, fontWeight: 500 }}>{tasks.length} TASKS</span>}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {view === "list" && (
            <button onClick={() => { setAdding(true); setTimeout(() => taRef.current?.focus(), 40); }} style={PB}>+ NEW</button>
          )}
          <span onClick={doSignOut}
            style={{ fontSize: 11, color: "#888", cursor: "pointer", letterSpacing: 1, fontWeight: 500 }}>
            sign out
          </span>
        </div>
      </div>

      {view === "list" && (
        <>
          <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", position: "relative" }}>
              <span style={{ position: "absolute", left: 14, color: "#666", fontSize: 16, pointerEvents: "none" }}>⌕</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search tasks and notes..."
                style={{ width: "100%", background: "transparent", border: "none", borderRight: "1px solid #1a1a1a", color: "#fff", fontSize: 13, padding: "12px 14px 12px 36px", fontFamily: "'DM Mono',monospace", fontWeight: 500 }}
              />
            </div>
            <button onClick={() => setSort(s => s === "desc" ? "asc" : "desc")}
              style={{ background: "transparent", border: "none", color: "#999", padding: "0 18px", whiteSpace: "nowrap", fontSize: 11, letterSpacing: 1, fontFamily: "'DM Mono',monospace", cursor: "pointer", fontWeight: 500 }}>
              DATE {sort === "desc" ? "↓" : "↑"}
            </button>
          </div>

          <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a", overflowX: "auto" }}>
            {[["all", "All", tasks.length], ...Object.entries(SC).map(([k, v]) => [k, v.label, statusCounts[k]])].map(([k, l, c]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                background: filter === k ? "#1a1a1a" : "transparent",
                color: filter === k ? "#fff" : "#888",
                border: "none", borderBottom: filter === k ? "2px solid #fff" : "2px solid transparent",
                padding: "11px 16px", fontSize: 11, letterSpacing: 1.5,
                fontFamily: "'DM Mono',monospace", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500,
              }}>
                {String(l).toUpperCase()} <span style={{ opacity: 0.6 }}>({c})</span>
              </button>
            ))}
          </div>

          {adding && (
            <div style={{ margin: "14px 18px", border: "1px solid #2a2a2a", background: "#111", padding: 16 }}>
              <div style={{ fontSize: 11, color: "#888", letterSpacing: 2, marginBottom: 10, fontWeight: 500 }}>NEW TASK</div>
              <textarea ref={taRef} value={newDesc} onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doAddTask(); }
                  if (e.key === "Escape") { setAdding(false); setNewDesc(""); }
                }}
                placeholder="Describe the task… (Enter to save, Esc to cancel)"
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #2a2a2a", color: "#fff", fontSize: 14, padding: "8px 0", resize: "none", minHeight: 56, lineHeight: 1.6, fontFamily: "'DM Mono',monospace", fontWeight: 500 }} />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={doAddTask} style={PB}>SAVE</button>
                <button onClick={() => { setAdding(false); setNewDesc(""); }} style={GB}>CANCEL</button>
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto" }}>
            {dbLoading
              ? <Center><span style={{ fontSize: 11, color: "#555", letterSpacing: 3 }}>LOADING...</span></Center>
              : list.length === 0
                ? <Center><span style={{ fontSize: 11, color: "#555", letterSpacing: 2 }}>{search ? `NO RESULTS FOR "${search.toUpperCase()}"` : "NO TASKS YET"}</span></Center>
                : list.map(task => {
                  const s = SC[task.status];
                  return (
                    <div key={task.id} onClick={() => doOpenTask(task)}
                      style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 18px", borderBottom: "1px solid #1a1a1a", cursor: "pointer", transition: "background 0.1s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#141414"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot, marginTop: 7, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: task.status === "closed" ? "#666" : "#fff", textDecoration: task.status === "closed" ? "line-through" : "none", lineHeight: 1.5, marginBottom: 5, fontWeight: 500, wordBreak: "break-word" }}>
                          <Hl text={task.description} q={search} />
                        </div>
                        <div style={{ fontSize: 11, color: "#666", letterSpacing: 1, fontWeight: 500 }}>{fmtShort(task.created_at)}</div>
                      </div>
                      <span style={{ fontSize: 10, letterSpacing: 1.5, padding: "4px 10px", background: s.bg, color: s.color, border: `1px solid ${s.border}`, flexShrink: 0, alignSelf: "center", fontWeight: 600 }}>
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
          <div style={{ padding: "22px 18px 18px", borderBottom: "1px solid #222" }}>
            <div style={{ fontSize: 11, color: "#777", letterSpacing: 2, marginBottom: 10, fontWeight: 500 }}>ADDED {fmt(curTask.created_at)}</div>
            <div style={{ fontSize: 16, color: "#fff", lineHeight: 1.6, marginBottom: 22, fontWeight: 500, wordBreak: "break-word" }}>{curTask.description}</div>
            <div style={{ fontSize: 11, color: "#888", letterSpacing: 2, marginBottom: 10, fontWeight: 500 }}>STATUS</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {Object.entries(SC).map(([key, cfg]) => {
                const on = curTask.status === key;
                return (
                  <button key={key} onClick={() => doUpdateStatus(curTask.id, key)}
                    style={{ background: on ? cfg.bg : "transparent", color: on ? cfg.color : "#888", border: `1px solid ${on ? cfg.border : "#2a2a2a"}`, padding: "6px 14px", fontSize: 10, letterSpacing: 1.5, fontFamily: "'DM Mono',monospace", cursor: "pointer", transition: "all 0.1s", fontWeight: 600 }}>
                    {cfg.label.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ flex: 1, padding: "20px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 11, color: "#888", letterSpacing: 2, fontWeight: 500 }}>NOTES {notes.length > 0 ? `(${notes.length})` : ""}</div>
            <div style={{ border: "1px solid #2a2a2a", background: "#111" }}>
              <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doAddNote(); } }}
                placeholder="Add a note… (Enter to save, Shift+Enter for new line)"
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #2a2a2a", color: "#fff", fontSize: 13, padding: "14px 14px", resize: "none", minHeight: 72, lineHeight: 1.7, fontFamily: "'DM Mono',monospace", fontWeight: 500 }} />
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 10px" }}>
                <button onClick={doAddNote} style={{ ...PB, fontSize: 10, padding: "7px 14px" }}>SAVE NOTE</button>
              </div>
            </div>
            {notes.length === 0
              ? <div style={{ fontSize: 12, color: "#555", letterSpacing: 1, fontWeight: 500 }}>NO NOTES YET</div>
              : [...notes].reverse().map(n => (
                <div key={n.id} style={{ paddingBottom: 14, borderBottom: "1px solid #1a1a1a" }}>
                  <div style={{ fontSize: 11, color: "#666", letterSpacing: 1, marginBottom: 7, fontWeight: 500 }}>{fmt(n.created_at)}</div>
                  <div style={{ fontSize: 14, color: "#ddd", lineHeight: 1.65, fontWeight: 500, wordBreak: "break-word" }}>
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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{background:#000;min-height:100vh;width:100%;}
        body{overflow-x:hidden;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:#000;}
        ::-webkit-scrollbar-thumb{background:#333;}
        textarea,input{outline:none;}
        input::placeholder,textarea::placeholder{color:#555;}
        mark{border-radius:1px;}
      `}</style>
      <div style={{ background: "#000", minHeight: "100vh", width: "100%" }}>
        <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "'DM Mono','Courier New',monospace", fontWeight: 500, display: "flex", flexDirection: "column", maxWidth: 760, margin: "0 auto" }}>
          {children}
        </div>
      </div>
    </>
  );
}

function Logo({ inline }) {
  return <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: inline ? 24 : 34, letterSpacing: 4, color: "#fff" }}>TASKBOARD</span>;
}

function Center({ children }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 20px" }}>{children}</div>;
}
