import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "";
const EVENT_NAME = import.meta.env.VITE_EVENT_NAME || "Event presence";
const SECRET_STORAGE_KEY = "eci_dashboard_secret_v1";

function getStoredSecret() {
  return sessionStorage.getItem(SECRET_STORAGE_KEY) || "";
}

function setStoredSecret(value) {
  sessionStorage.setItem(SECRET_STORAGE_KEY, value.trim());
}

function fmtDt(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

async function fetchRows(filter, secret) {
  if (!API_BASE) {
    throw new Error("Configure VITE_API_BASE in .env.");
  }

  const res = await fetch(`${API_BASE}/api/checkins?filter=${encodeURIComponent(filter)}`, {
    headers: { "X-Dashboard-Secret": secret },
  });

  if (res.status === 401) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    const err = new Error(data.error || "Failed to load.");
    err.status = res.status;
    throw err;
  }

  return data;
}

export default function App() {
  const [secret, setSecret] = useState(getStoredSecret());
  const [authError, setAuthError] = useState("");
  const [unlocked, setUnlocked] = useState(Boolean(getStoredSecret()));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentFilter, setCurrentFilter] = useState("all");

  useEffect(() => {
    if (unlocked) {
      loadRows(currentFilter);
    }
  }, [unlocked, currentFilter]);

  async function loadRows(filter) {
    setLoading(true);
    setAuthError("");
    try {
      const storedSecret = getStoredSecret();
      if (!storedSecret) {
        throw new Error("Enter your dashboard secret.");
      }
      const data = await fetchRows(filter, storedSecret);
      setRows(data);
    } catch (error) {
      if (error.status === 401) {
        sessionStorage.removeItem(SECRET_STORAGE_KEY);
        setSecret("");
        setUnlocked(false);
        setRows([]);
        setAuthError("Unauthorized — wrong secret.");
      } else {
        setAuthError(error.message || "Network error.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleUnlock() {
    setAuthError("");
    const trimmed = secret.replace(/•/g, "").trim();
    if (!trimmed) {
      setAuthError("Enter the dashboard secret.");
      return;
    }
    setStoredSecret(trimmed);
    setSecret(trimmed);
    setUnlocked(true);
  }

  return (
    <>
      <div className="bg" aria-hidden="true"></div>
      <div className="auth-overlay" style={{ display: unlocked ? "none" : "flex" }}>
        <div className="auth-card">
          <h2>Dashboard access</h2>
          <p>
            Enter your dashboard secret to access the check-in data.
          </p>
          <label htmlFor="secret-input" style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text)" }}>
            Secret Key
          </label>
          <input
            id="secret-input"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter secret key"
            autoComplete="off"
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleUnlock();
              }
            }}
          />
          <button type="button" className="btn" onClick={handleUnlock}>
            Access Dashboard
          </button>
          <div id="auth-error">{authError}</div>
        </div>
      </div>

      <div id="app-shell" className={unlocked ? "" : "is-hidden"}>
        <header>
          <h1>Event check-ins</h1>
          <p>Attendance & feedback · {EVENT_NAME}</p>
        </header>

        <div style={{ textAlign: "center" }}>
          <div className="stat">
            Rows: <strong id="stat-total">{rows.length}</strong>
          </div>
        </div>

        <div className="tabs">
          {[
            { key: "all", label: "All" },
            { key: "16", label: "16 April" },
            { key: "19", label: "19 April" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={currentFilter === tab.key ? "tab active" : "tab"}
              onClick={() => setCurrentFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="toolbar">
          <button type="button" className="btn-ghost" onClick={() => loadRows(currentFilter)}>
            ↻ Refresh
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Speciality</th>
                <th>Level</th>
                <th>Feedback</th>
                <th>Created at</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr id="loading-row">
                  <td colSpan="5">
                    <span className="shimmer"></span> Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr id="empty-row">
                  <td colSpan="5">No rows · unlock or adjust filters</td>
                </tr>
              )}
              {!loading && rows.map((row) => (
                <tr key={row.id || `${row.full_name}-${row.created_at}`} className="data-row">
                  <td>{row.full_name}</td>
                  <td>{row.speciality}</td>
                  <td className="mono">{row.level}</td>
                  <td className="feedback">{row.feedback || "—"}</td>
                  <td className="mono dim">{fmtDt(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
