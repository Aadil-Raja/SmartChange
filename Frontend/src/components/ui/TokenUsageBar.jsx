// src/components/ui/TokenUsageBar.jsx
import { useEffect, useRef } from "react";
import { Zap, AlertTriangle } from "lucide-react";
import { useChatbot } from "../../hooks/useChatbot";

const TokenUsageBar = () => {
  const { quota, fetchQuota } = useChatbot();
  const fallbackTimer = useRef(null);
  const resetTimer = useRef(null);

  // If quota is still null after 2s (e.g. Chatbot.jsx fetch failed), trigger a fetch here
  useEffect(() => {
    if (!quota) {
      fallbackTimer.current = setTimeout(() => {
        fetchQuota();
      }, 2000);
    }
    return () => clearTimeout(fallbackTimer.current);
  }, [quota]);

  // When exhausted and resets_at is known, auto-fetch when the window expires
  useEffect(() => {
    clearTimeout(resetTimer.current);
    if (!quota?.resets_at) return;
    const diff = new Date(quota.resets_at) - new Date();
    if (diff <= 0) {
      // Already expired — fetch immediately to get fresh quota
      fetchQuota();
      return;
    }
    // Schedule a fetch exactly when the window resets
    resetTimer.current = setTimeout(() => {
      fetchQuota();
    }, diff);
    return () => clearTimeout(resetTimer.current);
  }, [quota?.resets_at]);

  // Show a minimal placeholder while quota is loading
  if (!quota) {
    return (
      <div style={{ padding: "10px 14px", borderTop: "1px solid #e0d8ce", background: "#FAF6EF" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap size={12} style={{ color: "#F58220" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#3D2C1C" }}>AI Usage</span>
          </div>
          <span style={{ fontSize: 11, color: "#9c8e80" }}>Loading…</span>
        </div>
      </div>
    );
  }

  const { token_limit, tokens_used, tokens_remaining, resets_at, is_default } = quota;

  const hasLimit = token_limit != null && token_limit > 0;
  const pct = hasLimit ? Math.min(100, Math.round((tokens_used / token_limit) * 100)) : 0;
  const isWarning = hasLimit && pct >= 70 && pct < 90;
  const isDanger = hasLimit && pct >= 90;
  const isExhausted = hasLimit && tokens_remaining === 0;
  const barColor = isDanger ? "#ef4444" : isWarning ? "#f59e0b" : "#22c55e";

  const resetsIn = resets_at ? (() => {
    const diff = new Date(resets_at) - new Date();
    if (diff <= 0) return null; // already reset or imminent — don't show stale text
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })() : null;

  return (
    <div style={{ padding: "10px 14px", borderTop: "1px solid #e0d8ce", background: "#FAF6EF" }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          {isDanger
            ? <AlertTriangle size={12} style={{ color: "#ef4444" }} />
            : <Zap size={12} style={{ color: "#F58220" }} />}
          <span style={{ fontSize: 11, fontWeight: 600, color: "#3D2C1C" }}>AI Usage</span>
        </div>
        <span style={{ fontSize: 11, color: "#9c8e80" }}>
          {tokens_used.toLocaleString()} {hasLimit ? `/ ${token_limit.toLocaleString()} tokens` : "tokens used"}
        </span>      </div>

      {hasLimit && (
        <div style={{ height: 5, background: "#e0d8ce", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 99, transition: "width 0.5s ease" }} />
        </div>
      )}

      <div className="flex items-center justify-between mt-1">
        <span style={{ fontSize: 10, color: "#9c8e80" }}>
          {hasLimit
            ? `${(tokens_remaining ?? 0).toLocaleString()} remaining`
            : "No limit set"}
          {hasLimit && is_default && " (default)"}
        </span>
        {resets_at && resetsIn && (
          <span style={{ fontSize: 10, color: "#9c8e80" }}>Resets in {resetsIn}</span>
        )}
      </div>

      {isExhausted && (
        <div style={{ marginTop: 8, padding: "7px 10px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 11, color: "#b91c1c", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={12} />
          Token limit reached. {resetsIn ? `Resets in ${resetsIn}.` : "Contact your admin to reset."}
        </div>
      )}

      {isWarning && !isExhausted && (
        <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 11, color: "#92400e", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={12} />
          {pct}% of your token quota used.
        </div>
      )}
    </div>
  );
};

export default TokenUsageBar;
