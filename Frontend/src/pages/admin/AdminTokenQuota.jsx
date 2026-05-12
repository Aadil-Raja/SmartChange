// src/pages/admin/AdminTokenQuota.jsx
import { useState, useEffect } from "react";
import { Zap, Search, RefreshCw, Edit2, RotateCcw, X } from "lucide-react";
import AdminSidebar from "../../components/ui/AdminSidebar";
import api from "../../services/api";
import {
  useAdminTokenQuotaList,
  useAdminTokenOverview,
  useAdminTokenTopUsers,
  useAdminInvalidations,
} from "../../hooks/useAdminQueries";

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
    const limitNum = Number(limit);
    const hoursNum = Number(hours);
    if (!limitNum || limitNum < 1000) { setErr("Token limit must be at least 1,000"); return; }
    if (!hoursNum || hoursNum < 1) { setErr("Reset interval must be at least 1 hour"); return; }
    setSaving(true);
    setErr(null);
    try {
      await api.put(`/admin/users/${user.user_id}/quota`, {
        token_limit: limitNum,
        reset_interval_hours: hoursNum,
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
          placeholder="min 1,000"
          style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, marginBottom: 4, outline: "none" }} />
        <p style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Minimum: 1,000 tokens</p>

        <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, display: "block", marginBottom: 4 }}>Reset Every (hours)</label>
        <input type="number" value={hours} onChange={e => setHours(e.target.value)} min={1}
          style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 14, marginBottom: 4, outline: "none" }} />
        <p style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>Minimum: 1 hour</p>

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

function UsageHistoryModal({ user, onClose }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState(null); // {x, y, date, total}

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/users/${user.user_id}/quota/history?days=${days}`)
      .then(r => setData(r.data?.data || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [user.user_id, days]);

  const history = data?.history || [];
  const summary = data?.summary || { total: 0, peak: 0, active_days: 0 };
  const maxVal = summary.peak || 1;

  const fmtDate = (d) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(26,18,9,0.55)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, width: "min(680px, 95vw)", padding: 28, boxShadow: "0 20px 48px rgba(26,18,9,0.2)" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 style={{ fontFamily: "Georgia,serif", fontWeight: 700, color: C.ink, fontSize: 16 }}>
              Token Usage — {user.name || `User #${user.user_id}`}
            </h3>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{user.email} · data up to 5 min old</p>
          </div>
          <button onClick={onClose} style={{ color: C.muted }}><X size={16} /></button>
        </div>

        {/* Period tabs */}
        <div className="flex gap-2 mb-5">
          {[7, 15, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1.5px solid ${days === d ? C.orange : C.border}`, background: days === d ? "#fff5ec" : "#fff", color: days === d ? C.orange : C.muted, transition: "all 0.15s" }}>
              {d}d
            </button>
          ))}
        </div>

        {/* Summary stats */}
        <div className="flex gap-3 mb-5">
          {[
            { label: "Total tokens", value: summary.total.toLocaleString() },
            { label: "Peak day", value: summary.peak.toLocaleString() },
            { label: "Active days", value: `${summary.active_days} / ${days}` },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: "#faf6ef", borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{s.value}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        {loading ? (
          <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13 }}>Loading…</div>
        ) : history.length === 0 ? (
          <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13 }}>No usage data</div>
        ) : (
          <div style={{ position: "relative" }}>
            {/* Y-axis label */}
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>tokens / day</div>
            {/* Bars */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 140, paddingBottom: 0 }}>
              {history.map((d, i) => {
                const pct = maxVal > 0 ? (d.total / maxVal) * 100 : 0;
                const barH = Math.max(pct * 1.4, d.total > 0 ? 3 : 0);
                return (
                  <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", cursor: "pointer" }}
                    onMouseEnter={e => setTooltip({ i, date: d.date, total: d.total })}
                    onMouseLeave={() => setTooltip(null)}>
                    <div style={{
                      width: "100%", height: `${barH}px`,
                      background: tooltip?.i === i ? C.orange : (d.total > 0 ? "#f5c49a" : "#f0e8de"),
                      borderRadius: "3px 3px 0 0", transition: "background 0.15s",
                      minHeight: d.total > 0 ? 3 : 0,
                    }} />
                  </div>
                );
              })}
            </div>
            {/* X-axis labels — show every Nth to avoid crowding */}
            <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
              {history.map((d, i) => {
                const step = days <= 7 ? 1 : days <= 15 ? 2 : 5;
                const show = i % step === 0 || i === history.length - 1;
                return (
                  <div key={d.date} style={{ flex: 1, fontSize: 9, color: C.muted, textAlign: "center", overflow: "hidden" }}>
                    {show ? fmtDate(d.date) : ""}
                  </div>
                );
              })}
            </div>
            {/* Tooltip */}
            {tooltip && (
              <div style={{ position: "absolute", top: 0, left: `calc(${(tooltip.i / history.length) * 100}% + 4px)`, background: C.ink, color: "#faf6ef", borderRadius: 6, padding: "5px 9px", fontSize: 11, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10 }}>
                <div style={{ fontWeight: 600 }}>{fmtDate(tooltip.date)}</div>
                <div>{tooltip.total.toLocaleString()} tokens</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const AdminTokenQuota = () => {
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [search, setSearch] = useState("");
  const [resetting, setResetting] = useState(null);
  const [editing, setEditing] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [overviewDays, setOverviewDays] = useState(7);
  const [topLimit, setTopLimit] = useState(10);
  // Track the highest limit ever requested so we only fetch more, never less
  const [fetchedLimit, setFetchedLimit] = useState(10);

  // Reset fetchedLimit when period changes so we don't carry over a stale high-water mark
  useEffect(() => {
    setFetchedLimit(Math.max(10, topLimit));
  }, [overviewDays]);

  // Debounce topLimit — only bump fetchedLimit upward
  useEffect(() => {
    const t = setTimeout(() => {
      setFetchedLimit(prev => Math.max(prev, topLimit));
    }, 500);
    return () => clearTimeout(t);
  }, [topLimit]);

  // ── React Query ──────────────────────────────────────────────────────────
  const { data: quotaData, isLoading: loading, refetch: refetchQuota } = useAdminTokenQuotaList();
  const { data: overview } = useAdminTokenOverview(overviewDays);
  const { data: topUsersRaw = [] } = useAdminTokenTopUsers(overviewDays, fetchedLimit);
  // Slice client-side — decreasing never triggers a refetch
  const topUsers = topUsersRaw.slice(0, topLimit);
  const { invalidateTokenQuota } = useAdminInvalidations();

  const employees = quotaData?.employees || [];
  const quotas    = quotaData?.quotas    || {};
  const defaults  = quotaData?.defaults  || { token_limit: 100000, reset_interval_hours: 24 };

  const handleReset = async (userId) => {
    setResetting(userId);
    try {
      await api.post(`/admin/users/${userId}/quota/reset`);
      invalidateTokenQuota();
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
        </div>

        {/* Overview + Top Users */}
        <div className="px-8 pt-5 pb-2 flex-shrink-0">
          {/* Period selector + overview refresh */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>Period:</span>
              {[7, 15, 30].map(d => (
                <button key={d} onClick={() => setOverviewDays(d)}
                  style={{ padding: "4px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, border: `1.5px solid ${overviewDays === d ? C.orange : C.border}`, background: overviewDays === d ? "#fff5ec" : "#fff", color: overviewDays === d ? C.orange : C.muted }}>
                  {d}d
                </button>
              ))}
            </div>
            <span style={{ fontSize: 11, color: C.muted }}>Overview updates every 5 min</span>
          </div>

          {/* Summary stats */}
          {overview && (
            <div className="flex gap-3 mb-5">
              {[
                { label: "Total tokens", value: overview.total_tokens?.toLocaleString() ?? "—" },
                { label: "Total calls", value: overview.total_calls?.toLocaleString() ?? "—" },
                { label: "Active users", value: overview.active_users ?? "—" },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: "#fff", borderRadius: 10, padding: "12px 16px", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.ink }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.label} (last {overviewDays}d)</div>
                </div>
              ))}
            </div>
          )}

          {/* Top users */}
          {topUsers.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, padding: "16px 20px", marginBottom: 8 }}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Top users by token usage</span>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 11, color: C.muted }}>Show top</span>
                  <input type="number" min={1} max={20} value={topLimit}
                    onChange={e => setTopLimit(Math.min(20, Math.max(1, Number(e.target.value))))}
                    style={{ width: 48, padding: "3px 6px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, textAlign: "center" }} />
                  <span style={{ fontSize: 11, color: C.muted }}>max 20</span>
                </div>
              </div>
              {(() => {
                const maxT = topUsers[0]?.total_tokens || 1;
                return topUsers.map((u, i) => (
                  <div key={u.user_id} className="flex items-center gap-3 mb-2">
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, width: 18, textAlign: "right" }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name || `User #${u.user_id}`}</span>
                        <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, marginLeft: 8 }}>{u.total_tokens.toLocaleString()} tokens</span>
                      </div>
                      <div style={{ height: 5, background: "#f0e8de", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ width: `${(u.total_tokens / maxT) * 100}%`, height: "100%", background: i === 0 ? C.orange : "#f5c49a", borderRadius: 99 }} />
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="px-8 pt-2 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative" style={{ maxWidth: 340, flex: 1 }}>
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…"
                style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, outline: "none", background: "#fff" }} />
            </div>
            <button onClick={() => refetchQuota()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", color: C.muted, fontSize: 13, flexShrink: 0 }}>
              <RefreshCw size={13} /> Refresh table
            </button>
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
                            <button onClick={() => setViewingHistory({ ...emp, user_id: emp.id })}
                              title="View usage history"
                              style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: "#fff", color: C.muted, display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                              <Zap size={12} /> History
                            </button>
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

      {editing && <EditQuotaModal user={editing} onClose={() => setEditing(null)} onSaved={invalidateTokenQuota} defaultLimit={defaults.token_limit} defaultHours={defaults.reset_interval_hours} />}
      {viewingHistory && <UsageHistoryModal user={viewingHistory} onClose={() => setViewingHistory(null)} />}
    </div>
  );
};

export default AdminTokenQuota;
