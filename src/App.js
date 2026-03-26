import { useState, useEffect, useRef, useCallback } from "react";

const POLL_INTERVAL = 8000;

function classifyKeyword(text) {
  const t = text.toLowerCase();
  if (/\?|how |what |why |when |where |can you|could you|explain|difference between|is there|does it|do you|tell me|would you/.test(t)) return "question";
  if (/thank|love|amazing|best|incredible|appreciate|great|awesome|helpful|excellent|brilliant|perfect|wonderful|fantastic|congrats|well done|nice work|good job|superb/.test(t)) return "kind";
  return "general";
}

function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function initials(name) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "#3B5BDB", "#0CA678", "#F03E3E", "#F59F00",
  "#7950F2", "#1098AD", "#D6336C", "#2F9E44",
  "#E67E22", "#8E44AD",
];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const KW_TAG_COLORS = [
  { bg: "#1E3A5F", color: "#60A5FA" },
  { bg: "#14532D", color: "#4ADE80" },
  { bg: "#3B1F6E", color: "#C084FC" },
  { bg: "#451A03", color: "#FCD34D" },
  { bg: "#4A1942", color: "#F472B6" },
];

// ─── Context Menu ───────────────────────────────────────────────────────────
function ContextMenu({ x, y, onHighlight, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: "fixed", left: x, top: y, zIndex: 1000,
      background: "#1A1A1A", border: "1px solid #3A3A3A",
      borderRadius: 8, padding: "4px", minWidth: 160,
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    }}>
      <button onClick={onHighlight} style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", padding: "7px 12px", border: "none",
        background: "none", cursor: "pointer", borderRadius: 5,
        fontSize: 12, color: "#FCD34D", fontFamily: "inherit", textAlign: "left",
      }}
        onMouseEnter={(e) => e.currentTarget.style.background = "#2A2A2A"}
        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
      >
        <span style={{ fontSize: 14 }}>★</span> Add to Highlights
      </button>
    </div>
  );
}

// ─── Components ────────────────────────────────────────────────────────────

function Avatar({ name, photoUrl, size = 28 }) {
  const [err, setErr] = useState(false);
  if (photoUrl && !err) {
    return (
      <img src={photoUrl} alt={name} onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: avatarColor(name), color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700,
    }}>{initials(name)}</div>
  );
}

function highlightKeywords(text, keywords) {
  if (!keywords.length) return text;
  const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part)
      ? <span key={i} style={{ color: "#C084FC", fontWeight: 700 }}>{part}</span>
      : part
  );
}

function MessageRow({ msg, onReclassify, onHighlight, keywords = [], compact = false, isHighlighted = false }) {
  const [hover, setHover] = useState(false);
  const sz = compact ? 24 : 28;
  const fsz = compact ? 11 : 12;

  const kwMatches = keywords.filter((k) =>
    msg.text.toLowerCase().includes(k.toLowerCase())
  );

  const handleContextMenu = (e) => {
    if (onHighlight) {
      e.preventDefault();
      onHighlight(e, msg);
    }
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onContextMenu={handleContextMenu}
      style={{
        display: "flex", gap: 7, padding: compact ? "5px 10px" : "6px 12px",
        background: isHighlighted ? "rgba(253,210,0,0.06)" : hover ? "#222" : "transparent",
        borderRadius: 5, transition: "background 0.1s", position: "relative",
        borderLeft: isHighlighted ? "2px solid #FCD34D" : "2px solid transparent",
      }}
    >
      <Avatar name={msg.author} photoUrl={msg.authorPhoto} size={sz} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: msg.isModerator ? "#C084FC" : msg.isOwner ? "#FCD34D" : "#E5E7EB",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{msg.author}</span>
          {msg.isModerator && (
            <span style={{ fontSize: 9, background: "#3B1F6E", color: "#C084FC", padding: "1px 5px", borderRadius: 3 }}>MOD</span>
          )}
          {msg.category === "question" && (
            <span style={{ fontSize: 9, fontWeight: 700, background: "#1E3A5F", color: "#60A5FA", padding: "1px 5px", borderRadius: 3 }}>Q</span>
          )}
          {msg.category === "kind" && (
            <span style={{ fontSize: 9, fontWeight: 700, background: "#14532D", color: "#4ADE80", padding: "1px 5px", borderRadius: 3 }}>♥</span>
          )}
          {kwMatches.map((k, i) => (
            <span key={i} style={{ fontSize: 9, fontWeight: 700, background: "#2A2347", color: "#A78BFA", padding: "1px 5px", borderRadius: 3 }}>{k}</span>
          ))}
          {isHighlighted && (
            <span style={{ fontSize: 9, color: "#FCD34D" }}>★</span>
          )}
          {msg.edited && (
            <span style={{ fontSize: 9, color: "#4B5563", fontStyle: "italic" }}>edited</span>
          )}
          <span style={{ fontSize: 10, color: "#4B5563", marginLeft: "auto", flexShrink: 0 }}>
            {timeAgo(msg.publishedAt)}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: fsz, color: "#D1D5DB", lineHeight: 1.45, wordBreak: "break-word" }}>
          {highlightKeywords(msg.text, keywords)}
        </p>
      </div>

      {hover && onReclassify && (
        <div style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          display: "flex", gap: 3, background: "#2A2A2A", border: "1px solid #3A3A3A",
          borderRadius: 6, padding: "3px 6px", zIndex: 10,
        }}>
          {["question", "kind", "general"].filter((t) => t !== msg.category).map((t) => (
            <button key={t} onClick={() => onReclassify(msg.id, t)} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 10, color: "#9CA3AF", padding: "2px 5px", borderRadius: 3,
              fontFamily: "inherit",
            }}
              onMouseEnter={(e) => e.target.style.background = "#333"}
              onMouseLeave={(e) => e.target.style.background = "none"}
            >→{t}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Panel({ title, dotColor, count, messages, onReclassify, keywords, emptyText, borderAccent }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", minHeight: 0,
      background: "#1A1A1A", borderRadius: 10,
      border: `1px solid ${borderAccent || "#2A2A2A"}`, overflow: "hidden",
    }}>
      <div style={{
        padding: "8px 12px", borderBottom: `1px solid ${borderAccent || "#232323"}`,
        display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
      }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#F3F4F6" }}>{title}</span>
        <span style={{
          marginLeft: "auto", fontSize: 10, fontWeight: 600,
          background: "#2A2A2A", color: "#9CA3AF", padding: "1px 7px", borderRadius: 10,
        }}>{count}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "3px 0" }}>
        {messages.length === 0 ? (
          <p style={{ color: "#4B5563", fontSize: 11, textAlign: "center", padding: "20px 12px", lineHeight: 1.6 }}>{emptyText}</p>
        ) : (
          messages.map((m) => (
            <MessageRow key={m.id} msg={m} onReclassify={onReclassify} keywords={keywords} compact />
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ─── Highlights Panel ───────────────────────────────────────────────────────
function HighlightsPanel({ messages, onRemove, keywords }) {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", minHeight: 0,
      background: "#1A1A1A", borderRadius: 10,
      border: "1px solid #3A3210", overflow: "hidden",
    }}>
      <div style={{
        padding: "8px 12px", borderBottom: "1px solid #2A2510",
        display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: "#FCD34D" }}>★</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#F3F4F6" }}>Highlights</span>
        <span style={{
          marginLeft: "auto", fontSize: 10, fontWeight: 600,
          background: "#2A2A2A", color: "#9CA3AF", padding: "1px 7px", borderRadius: 10,
        }}>{messages.length}</span>
        {messages.length > 0 && (
          <button onClick={onRemove} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 10, color: "#4B5563", fontFamily: "inherit", marginLeft: 4,
          }}
            onMouseEnter={(e) => e.target.style.color = "#EF4444"}
            onMouseLeave={(e) => e.target.style.color = "#4B5563"}
            title="Clear all highlights"
          >Clear all</button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "3px 0" }}>
        {messages.length === 0 ? (
          <p style={{ color: "#4B5563", fontSize: 11, textAlign: "center", padding: "20px 12px", lineHeight: 1.6 }}>
            Right-click any message in All Chat to highlight it
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ position: "relative" }}>
              <MessageRow msg={m} keywords={keywords} compact isHighlighted />
              <button
                onClick={() => onRemove(m.id)}
                style={{
                  position: "absolute", right: 8, top: 8,
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 13, color: "#4B5563", fontFamily: "inherit", lineHeight: 1,
                }}
                onMouseEnter={(e) => e.target.style.color = "#EF4444"}
                onMouseLeave={(e) => e.target.style.color = "#4B5563"}
                title="Remove highlight"
              >×</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Keyword Tag ────────────────────────────────────────────────────────────
function KeywordTag({ kw, colorIdx, onRemove }) {
  const c = KW_TAG_COLORS[colorIdx % KW_TAG_COLORS.length];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 20, background: c.bg, color: c.color,
      fontSize: 11, fontWeight: 600,
    }}>
      {kw}
      <button onClick={() => onRemove(kw)} style={{
        background: "none", border: "none", cursor: "pointer",
        color: c.color, fontSize: 14, lineHeight: 1, padding: 0,
        opacity: 0.7, fontFamily: "inherit",
      }}>×</button>
    </span>
  );
}

// ─── Settings Modal ─────────────────────────────────────────────────────────
function SettingsModal({ onClose, backendUrl, setBackendUrl }) {
  const [localUrl, setLocalUrl] = useState(backendUrl);
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#1A1A1A", border: "1px solid #333",
        borderRadius: 12, padding: 24, width: 480, maxWidth: "90vw",
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>⚙ Settings</h2>
        <label style={{ display: "block", marginBottom: 24 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
            Railway Backend URL
          </span>
          <input value={localUrl} onChange={(e) => setLocalUrl(e.target.value)}
            placeholder="https://your-app.up.railway.app"
            style={{
              width: "100%", fontSize: 13, padding: "8px 10px",
              borderRadius: 6, border: "1px solid #333",
              background: "#111", color: "#D1D5DB", outline: "none",
              boxSizing: "border-box", fontFamily: "inherit",
            }} />
          <span style={{ fontSize: 11, color: "#4B5563", marginTop: 4, display: "block" }}>
            Your Railway backend URL — from Settings → Networking in your Railway project.
          </span>
        </label>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 6, border: "1px solid #333",
            background: "none", cursor: "pointer", fontSize: 13, color: "#9CA3AF", fontFamily: "inherit",
          }}>Cancel</button>
          <button onClick={() => { setBackendUrl(localUrl.replace(/\/$/, "")); onClose(); }} style={{
            padding: "8px 16px", borderRadius: 6, border: "none",
            background: "#1D4ED8", color: "#fff", cursor: "pointer",
            fontSize: 13, fontWeight: 600, fontFamily: "inherit",
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [url, setUrl] = useState("");
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSince, setLastSince] = useState(null);
  const [backendUrl, setBackendUrl] = useState(() => localStorage.getItem("ytcd_backend") || "");
  const [showSettings, setShowSettings] = useState(false);
  const [showInfo, setShowInfo] = useState(() => localStorage.getItem("ytcd_hideinfo") !== "true");
  const [status, setStatus] = useState("idle");

  const [keywords, setKeywords] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ytcd_keywords") || "[]"); } catch { return []; }
  });
  const [kwInput, setKwInput] = useState("");
  const [kwColorIdx, setKwColorIdx] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ytcd_keywords") || "[]").length; } catch { return 0; }
  });

  // Highlights
  const [highlighted, setHighlighted] = useState([]);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, msg }

  const allEndRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => { localStorage.setItem("ytcd_backend", backendUrl); }, [backendUrl]);
  useEffect(() => { localStorage.setItem("ytcd_keywords", JSON.stringify(keywords)); }, [keywords]);
  useEffect(() => { allEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  // Close context menu on scroll or escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") setContextMenu(null); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const addKeyword = () => {
    const val = kwInput.trim();
    if (!val || keywords.includes(val)) return;
    setKeywords((prev) => [...prev, val]);
    setKwColorIdx((i) => i + 1);
    setKwInput("");
  };

  const removeKeyword = (kw) => setKeywords((prev) => prev.filter((k) => k !== kw));

  const openContextMenu = (e, msg) => {
    e.preventDefault();
    // Adjust position so menu doesn't go off screen
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 80);
    setContextMenu({ x, y, msg });
  };

  const addHighlight = () => {
    if (!contextMenu) return;
    const msg = contextMenu.msg;
    setHighlighted((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
    setContextMenu(null);
  };

  const removeHighlight = (id) => {
    if (typeof id === "string") {
      setHighlighted((prev) => prev.filter((m) => m.id !== id));
    } else {
      setHighlighted([]); // clear all
    }
  };

  const fetchChat = useCallback(async (streamUrl, since) => {
    if (!backendUrl) { setError("Set your Railway backend URL in ⚙ Settings first."); return; }
    setStatus("polling");
    try {
      const params = new URLSearchParams({ url: streamUrl });
      if (since) params.append("since", since);
      const res = await fetch(`${backendUrl}/chat?${params}`);
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Backend error"); }
      const data = await res.json();
      const newMsgs = data.messages || [];
      if (newMsgs.length > 0) {
        const classified = newMsgs.map((m) => ({
          ...m,
          category: m.category || classifyKeyword(m.text),
          edited: false,
        }));
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const fresh = classified.filter((m) => !existingIds.has(m.id));
          return [...prev, ...fresh].slice(-500);
        });
        const newest = newMsgs.reduce((a, b) => a.publishedAt > b.publishedAt ? a : b);
        setLastSince(newest.publishedAt);
      }
      setStatus("polling");
      setError("");
    } catch (e) {
      setStatus("error");
      setError(e.message);
    }
  }, [backendUrl]);

  const connect = async () => {
    if (!url.trim()) { setError("Paste a YouTube live stream URL"); return; }
    if (!backendUrl) { setShowSettings(true); return; }
    setLoading(true);
    setMessages([]);
    setLastSince(null);
    setError("");
    await fetchChat(url.trim(), null);
    setConnected(true);
    setLoading(false);
  };

  const disconnect = () => {
    setConnected(false);
    clearInterval(pollRef.current);
    setStatus("idle");
    setMessages([]);
    setLastSince(null);
  };

  useEffect(() => {
    if (!connected) { clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(() => fetchChat(url, lastSince), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [connected, url, lastSince, fetchChat]);

  const reclassify = (id, newCat) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, category: newCat, edited: true } : m));
  };

  const highlightedIds = new Set(highlighted.map((m) => m.id));
  const questions = messages.filter((m) => m.category === "question");
  const kindWords = messages.filter((m) => m.category === "kind");
  const kwMatches = messages.filter((m) =>
    keywords.some((k) => m.text.toLowerCase().includes(k.toLowerCase()))
  );

  const statusColor = { idle: "#6B7280", polling: "#10B981", error: "#EF4444" }[status];
  const statusLabel = status === "idle" ? "Idle" : status === "polling" ? `Live · ${messages.length} msgs` : "Error";

  return (
    <div style={{
      height: "100vh", background: "#0F0F0F",
      display: "flex", flexDirection: "column",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#F9FAFB", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        background: "#1A1A1A", borderBottom: "1px solid #2A2A2A",
        padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, background: "#FF0000", borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 12, fontWeight: 800, flexShrink: 0,
        }}>▶</div>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", whiteSpace: "nowrap" }}>
          YouTube Chat Dashboard
        </span>

        <div style={{ flex: 1, display: "flex", gap: 7, maxWidth: 560 }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !connected && connect()}
            placeholder="Paste YouTube live stream URL..."
            disabled={connected}
            style={{
              flex: 1, fontSize: 13, padding: "7px 10px",
              borderRadius: 6, border: "1px solid #333",
              background: connected ? "#0D0D0D" : "#111",
              color: "#D1D5DB", outline: "none", fontFamily: "inherit",
            }}
          />
          {!connected ? (
            <button onClick={connect} disabled={loading} style={{
              padding: "7px 16px", borderRadius: 6, border: "none",
              background: loading ? "#374151" : "#1D4ED8",
              color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap", fontFamily: "inherit",
            }}>{loading ? "Connecting…" : "Connect"}</button>
          ) : (
            <button onClick={disconnect} style={{
              padding: "7px 14px", borderRadius: 6, border: "1px solid #3A3A3A",
              background: "none", color: "#EF4444",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>Disconnect</button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6B7280" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor }} />
            {statusLabel}
          </div>
          <button onClick={() => setShowSettings(true)} style={{
            padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            cursor: "pointer", border: "1px solid #333",
            background: "#222", color: "#D1D5DB", fontFamily: "inherit",
          }}>⚙ Settings</button>
        </div>
      </div>

      {/* Info banner */}
      {showInfo && (
        <div style={{
          background: "#111827", borderBottom: "1px solid #1F2937",
          padding: "10px 16px", flexShrink: 0,
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#E5E7EB", margin: "0 0 6px" }}>
              How it works
            </p>
            <p style={{ fontSize: 11, color: "#6B7280", margin: "0 0 8px" }}>
              Paste a YouTube live stream URL in the bar above and hit Connect to get started.
            </p>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, background: "#1E3A5F", color: "#60A5FA", padding: "1px 5px", borderRadius: 3 }}>Q</span>
                Questions auto-detected by AI
              </span>
              <span style={{ fontSize: 11, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, background: "#14532D", color: "#4ADE80", padding: "1px 5px", borderRadius: 3 }}>♥</span>
                Kind words auto-detected by AI
              </span>
              <span style={{ fontSize: 11, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, background: "#2A2347", color: "#A78BFA", padding: "1px 5px", borderRadius: 3 }}>kw</span>
                Keyword filters catch specific phrases like @question
              </span>
              <span style={{ fontSize: 11, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 12, color: "#FCD34D" }}>★</span>
                Right-click any message to highlight it
              </span>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                Hover any message to manually reclassify it
              </span>
            </div>
          </div>
          <button onClick={() => { setShowInfo(false); localStorage.setItem("ytcd_hideinfo", "true"); }} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#4B5563", fontSize: 16, lineHeight: 1, padding: 0,
            flexShrink: 0, fontFamily: "inherit",
          }}>×</button>
        </div>
      )}

      {/* Keyword filter bar */}
      <div style={{
        background: "#161616", borderBottom: "1px solid #2A2A2A",
        padding: "7px 16px", display: "flex", alignItems: "center",
        gap: 8, flexShrink: 0, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 11, color: "#6B7280", whiteSpace: "nowrap", flexShrink: 0 }}>
          Keyword filters:
        </span>
        <input
          value={kwInput}
          onChange={(e) => setKwInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addKeyword()}
          placeholder="e.g. @question, !trade, giveaway"
          style={{
            fontSize: 12, padding: "4px 9px", borderRadius: 5,
            border: "1px solid #333", background: "#111",
            color: "#D1D5DB", outline: "none", width: 210, fontFamily: "inherit",
          }}
        />
        <button onClick={addKeyword} style={{
          padding: "4px 12px", borderRadius: 5, border: "none",
          background: "#1D4ED8", color: "#fff",
          fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}>+ Add</button>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          {keywords.map((kw, i) => (
            <KeywordTag key={kw} kw={kw} colorIdx={i} onRemove={removeKeyword} />
          ))}
        </div>
        {keywords.length === 0 && (
          <span style={{ fontSize: 10, color: "#374151" }}>
            Add keywords — messages containing them auto-route to the Keyword Matches panel
          </span>
        )}
      </div>

      {/* Error bar */}
      {error && (
        <div style={{
          background: "#1F0A0A", borderBottom: "1px solid #7F1D1D",
          padding: "7px 16px", fontSize: 12, color: "#FCA5A5",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>⚠ {error}</span>
          <button onClick={() => setError("")} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#FCA5A5", fontSize: 16, fontFamily: "inherit",
          }}>×</button>
        </div>
      )}

      {/* Main panels */}
      <div style={{
        flex: 1, display: "flex", gap: 10, padding: 12,
        minHeight: 0, overflow: "hidden",
      }}>
        {/* Left: All chat */}
        <div style={{
          flex: "0 0 340px", display: "flex", flexDirection: "column",
          background: "#1A1A1A", borderRadius: 10, border: "1px solid #2A2A2A", overflow: "hidden",
        }}>
          <div style={{
            padding: "8px 12px", borderBottom: "1px solid #232323",
            display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6B7280" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#F3F4F6" }}>All Chat</span>
            <span style={{ fontSize: 10, color: "#4B5563", marginLeft: 4 }}>right-click to highlight</span>
            <span style={{
              marginLeft: "auto", fontSize: 10, fontWeight: 600,
              background: "#2A2A2A", color: "#9CA3AF", padding: "1px 7px", borderRadius: 10,
            }}>{messages.length}</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "3px 0" }}>
            {messages.length === 0 ? (
              <p style={{ color: "#4B5563", fontSize: 11, textAlign: "center", padding: "28px 12px", lineHeight: 1.6 }}>
                {connected ? "Waiting for messages…" : "Connect to a live stream to see chat"}
              </p>
            ) : (
              messages.map((m) => (
                <MessageRow
                  key={m.id}
                  msg={m}
                  onReclassify={reclassify}
                  onHighlight={openContextMenu}
                  keywords={keywords}
                  isHighlighted={highlightedIds.has(m.id)}
                />
              ))
            )}
            <div ref={allEndRef} />
          </div>
        </div>

        {/* Right: filtered panels */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
          <HighlightsPanel
            messages={highlighted}
            onRemove={removeHighlight}
            keywords={keywords}
          />
          <Panel
            title="Questions"
            dotColor="#3B82F6"
            count={questions.length}
            messages={questions}
            onReclassify={reclassify}
            keywords={keywords}
            emptyText="No questions detected yet"
          />
          <Panel
            title="Kind Words"
            dotColor="#10B981"
            count={kindWords.length}
            messages={kindWords}
            onReclassify={reclassify}
            keywords={keywords}
            emptyText="No kind words detected yet"
            borderAccent="#1D3A3A"
          />
          <Panel
            title="Keyword Matches"
            dotColor="#A78BFA"
            count={kwMatches.length}
            messages={kwMatches}
            onReclassify={reclassify}
            keywords={keywords}
            emptyText={keywords.length === 0
              ? "Add keyword filters above to use this panel"
              : "No keyword matches yet — waiting for messages containing your filters"}
            borderAccent="#2A2347"
          />
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onHighlight={addHighlight}
          onClose={() => setContextMenu(null)}
        />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          backendUrl={backendUrl}
          setBackendUrl={setBackendUrl}
        />
      )}
    </div>
  );
}