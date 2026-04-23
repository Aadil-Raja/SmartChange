// src/pages/admin/AdminTokenQuota.jsx
import { useState, useEffect, useRef } from "react";
import { Zap, Search, RefreshCw, Edit2, RotateCcw, X } from "lucide-react";
import AdminSidebar from "../../components/ui/AdminSidebar";
import api from "../../services/api";

const C = {
  bg: "#faf6ef", ink: "#1a1209", orange: "#F58220", muted: "#9c8e80",
  border: "#e0d8ce", card: "#ffffff",
};

function UsageBar({ used, limit }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ width: "100%" }}>
      <div className="flex justify-between mb-1" style={{ fontSize: 11, color: C.muted }}>
        <span>{used.toLocaleString()} used</span>
        <span>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "#f0e8de", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.4s" }} />
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
        {Math.max(0, limit - used).toLocaleString()} remaining of {limit.toLocaleString()}
      </div>
    </div>
  );
}

function EditQuotaModal({ user, onClose, onSaved, defaultLimit, defaultHours }) {
  const [limit, setLimit] = useState(user.token_limit || defaultLimit);
  const [hours, setHours] = useState(user.reset_interval_hours || defaultHours);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const applyDefaults = () => {
    setLimit(defaultLimit);
    setHours(defaultHours);
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await api.put(`/admin/users/${user.user_id}/quota`, {
        token_limit: Number(limit),
        reset_interval_hours: Number(hours),
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(26,18,9,0.5)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, width: 380, padding: 28, boxShadow: "0 20px 48px rgba(26,18,9,0.2)" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 style={{ fontFamily: "Georgia,serif", fontWeight: 700, color: C.ink, fontSize: 16 }}>
            Edit Quota — {user.name || `User #${user.user_id}`}
          </h3>
          <button onClick={onClose} style={{ color: C.muted }}><X size={16} /></button>
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, display: "block", marginBottom: 4 }}>Token Limit</label>
        <input type="number" value={limit} onChange={e => setLimit(e.target.value)} min={1000}
          style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, marginBottom: 14, outline: "none" }} />

        <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, display: "block", marginBottom: 4 }}>Reset Every (hours)</label>
        <input type="number" value={hours} onChange={e => setHours(e.target.value)} min={1}
          style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, marginBottom: 20, outline: "none" }} />

        {err && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>{err}</p>}

        <div className="flex gap-2 justify-between">
          <button onClick={applyDefaults}
            style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, background: "#f3ede4" }}>
            Use Defaults
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, color: C.muted, background: "#f3ede4" }}>Cancel</button>
            <button onClick={save} disabled={saving}
              style={{ padding: "8px 18px", borderRadius: 8, background: C.ink, color: "#faf6ef", fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const AdminTokenQuota = () => {
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [quotas, setQuotas] = useState({});
  const [defaults, setDefaults] = useState({ token_limit: 100000, reset_interval_hours: 24 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(null);
  const [editing, setEditing] = useState(null);
  const hasFetched = useRef(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const empRes = await api.get("/admin/employees");
      const raw = empRes.data?.data?.employees || [];
      // Deduplicate by user id (users with multiple team memberships appear multiple times)
      const seen = new Set();
      const emps = raw.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
      setEmployees(emps);

      // Fetch quota for each employee in parallel
      const quotaResults = await Promise.allSettled(
        emps.map(e => api.get(`/admin/users/${e.id}/quota`).then(r => ({ id: e.id, data: r.data?.data })))
      );
      const map = {};
      quotaResults.forEach(r => {
        if (r.status === "fulfilled") {
          map[r.value.id] = r.value.data;
          // Extract system defaults from any response that has them
          if (r.value.data?.note && r.value.data?.token_limit) {
            setDefaults({ token_limit: r.value.data.token_limit, reset_interval_hours: r.value.data.reset_interval_hours });
          }
        }
      });
      setQuotas(map);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasFetched.current) { hasFetched.current = true; loadData(); }
  }, []);

  const handleReset = async (userId) => {
    setResetting(userId);
    try {
      await api.post(`/admin/users/${userId}/quota/reset`);
      await loadData();
    } catch (e) { console.error(e); }
    finally { setResetting(null); }
  };

  const filtered = employees.filter(e =>
    (e.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.bg }}>
      <AdminSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <div className="w-full px-8 py-5 flex items-center justify-between flex-shrink-0"
          style={{ background: C.bg, borderBottom: `2px solid ${C.orange}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#1A1209" }}>
              <Zap size={17} color={C.orange} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#3D2C1C", fontFamily: "Georgia,serif" }}>
                Token Quota
              </h1>
              <p style={{ color: "rgba(65,50,24,0.5)", fontSize: 13, marginTop: 2 }}>
                Monitor and manage per-user AI token usage
              </p>
            </div>
          </div>
          <button onClick={loadData} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", color: C.muted, fontSize: 13 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Search */}
        <div className="px-8 pt-5 pb-3 flex-shrink-0">
          <div className="relative" style={{ maxWidth: 340 }}>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…"
              style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, outline: "none", background: "#fff" }} />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-20" style={{ color: C.muted, fontSize: 14 }}>Loading…</div>
          ) : (
            <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#FAF6EF", borderBottom: `1px solid ${C.border}` }}>
                    {["Employee", "Usage", "Limit", "Reset Interval", "Resets At", "Actions"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp, i) => {
                    const q = quotas[emp.id];
                    const used = q?.tokens_used ?? 0;
                    const limit = q?.token_limit ?? null;
                    const hours = q?.reset_interval_hours ?? null;
                    const isDefault = !!q?.note; // has "note" = using system defaults, no real row
                    const resetsAt = q?.resets_at
                      ? new Date(q.resets_at).toLocaleString()
                      : "Not set yet";
                    return (
                      <tr key={emp.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <td style={{ padding: "14px 16px" }}>
                          <p style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>{emp.name || "—"}</p>
                          <p style={{ fontSize: 11, color: C.muted }}>{emp.email}</p>
                        </td>
                        <td style={{ padding: "14px 16px", minWidth: 180 }}>
                          {typeof limit === "number"
                            ? <UsageBar used={used} limit={limit} />
                            : <span style={{ fontSize: 12, color: C.muted }}>No quota set</span>}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: 13, color: C.ink }}>
                          {limit !== null ? limit.toLocaleString() : "—"}
                          {isDefault && limit !== null && <span style={{ fontSize: 10, color: C.muted, marginLeft: 4 }}>(default)</span>}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: 13, color: C.ink }}>
                          {hours !== null ? `${hours}h` : "—"}
                          {isDefault && hours !== null && <span style={{ fontSize: 10, color: C.muted, marginLeft: 4 }}>(default)</span>}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: 12, color: C.muted }}>{resetsAt}</td>
                        <td style={{ padding: "14px 16px" }}>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setEditing({ ...emp, user_id: emp.id, token_limit: q?.token_limit, reset_interval_hours: q?.reset_interval_hours })}
                              title="Edit quota"
                              style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: "#fff", color: C.muted, display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                              <Edit2 size={12} /> Edit
                            </button>
                            <button onClick={() => handleReset(emp.id)} disabled={resetting === emp.id || !q}
                              title="Reset window now"
                              style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: resetting === emp.id ? "#f3ede4" : "#fff", color: C.muted, display: "flex", alignItems: "center", gap: 4, fontSize: 12, opacity: !q ? 0.4 : 1 }}>
                              <RotateCcw size={12} /> Reset
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>No employees found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && <EditQuotaModal user={editing} onClose={() => setEditing(null)} onSaved={loadData} defaultLimit={defaults.token_limit} defaultHours={defaults.reset_interval_hours} />}
    </div>
  );
};

export default AdminTokenQuota;
