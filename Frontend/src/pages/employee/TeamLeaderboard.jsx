import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTeamLeaderboard, useTeamEngagement } from '../../hooks/useEmployeeQueries';
import EmployeeSidebar from '../../components/ui/EmployeeSidebar';
import { Trophy, Users, FileText, CheckCircle, Zap, BookOpen, ChevronDown, ChevronUp, Info, X } from 'lucide-react';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

const POINTS_RULES = [
  { icon: '📄', label: 'Content item completed', pts: 10 },
  { icon: '✅', label: 'Quiz passed',             pts: 20 },
  { icon: '⚡', label: 'Quiz passed (1st attempt)', pts: 30, note: 'replaces the 20' },
  { icon: '🎓', label: 'Course completed',         pts: 50 },
];

const Avatar = ({ url, name, size = 40 }) => {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return url ? (
    <img src={url} alt={name} className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 font-bold"
      style={{ width: size, height: size, background: 'rgba(245,130,32,0.12)', color: '#f7953f', fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sub }) => (
  <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: '#fff', border: '1px solid #e8e0d4' }}>
    <div className="rounded-lg p-2.5 flex-shrink-0" style={{ background: 'rgba(245,130,32,0.08)' }}>
      <Icon size={17} style={{ color: '#f7953f' }} />
    </div>
    <div>
      <p className="text-2xl font-bold leading-none" style={{ color: '#3D2C1C' }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'rgba(65,50,24,0.45)' }}>{label}</p>
      {sub && <p className="text-xs mt-0.5 font-semibold" style={{ color: '#f7953f' }}>{sub}</p>}
    </div>
  </div>
);

const SummaryRow = ({ icon, label, value, sub }) => (
  <div className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-2 min-w-0">
      <span style={{ color: '#f7953f', flexShrink: 0 }}>{icon}</span>
      <span className="text-xs truncate" style={{ color: 'rgba(65,50,24,0.55)' }}>{label}</span>
    </div>
    <div className="text-right flex-shrink-0">
      <span className="text-sm font-bold" style={{ color: '#3D2C1C' }}>{value}</span>
      {sub && <p className="text-xs font-medium" style={{ color: '#f7953f' }}>{sub}</p>}
    </div>
  </div>
);

const BreakdownChips = ({ entry }) => {
  const chips = [];
  if (entry.content_done > 0)
    chips.push(`📄 ${entry.content_done} content · +${entry.content_done * 10}pts`);
  if (entry.quizzes_passed > 0) {
    const bonus = entry.first_attempt_passes > 0 ? ` (${entry.first_attempt_passes} first-try ⚡)` : '';
    chips.push(`✅ ${entry.quizzes_passed} quiz pass · +${entry.quizzes_passed * 20}pts${bonus}`);
  }
  if (entry.courses_completed > 0)
    chips.push(`🎓 ${entry.courses_completed} course · +${entry.courses_completed * 50}pts`);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map((c, i) => (
        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
          style={{ background: 'rgba(245,130,32,0.08)', color: 'rgba(65,50,24,0.65)', border: '1px solid rgba(245,130,32,0.2)' }}>
          {c}
        </span>
      ))}
    </div>
  );
};

const PodiumCard = ({ entry, position }) => {
  if (!entry) return <div className="flex-1" />;
  const podiumH = { 1: 96, 2: 64, 3: 48 };
  const avatarSize = { 1: 60, 2: 48, 3: 44 };
  const order = { 1: 'order-2', 2: 'order-1', 3: 'order-3' };
  const podiumBg = { 1: '#f7953f', 2: '#c4a882', 3: '#d4c4b0' };

  return (
    <div className={`flex flex-col items-center gap-1.5 flex-1 ${order[position]}`}>
      <div className="relative mb-1">
        <Avatar url={entry.avatar_url} name={entry.name} size={avatarSize[position]} />
        <span className="absolute -top-1 -right-1" style={{ fontSize: position === 1 ? 20 : 16 }}>{MEDAL[position]}</span>
        {entry.is_me && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full font-bold"
            style={{ background: '#f7953f', color: '#fff', fontSize: 8, whiteSpace: 'nowrap' }}>YOU</span>
        )}
      </div>
      <p className="text-xs font-semibold text-center truncate w-full px-1" style={{ color: '#3D2C1C' }}>
        {entry.name.split(' ')[0]}
      </p>
      <p className="font-bold" style={{ color: '#f7953f', fontSize: position === 1 ? 15 : 13 }}>
        {entry.points} pts
      </p>
      <div className="w-full rounded-t-lg" style={{ height: podiumH[position], background: podiumBg[position] }} />
    </div>
  );
};

const PointsLegendPopover = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
        style={{ background: open ? 'rgba(247,149,63,0.15)' : 'rgba(247,149,63,0.08)', color: '#f7953f', border: '1px solid rgba(247,149,63,0.25)' }}
      >
        <Info size={13} /> How points work
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 rounded-2xl shadow-xl p-4 w-64"
          style={{ background: '#fff', border: '1px solid #e8e0d4' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(65,50,24,0.4)' }}>Points breakdown</p>
            <button onClick={() => setOpen(false)}><X size={14} style={{ color: 'rgba(65,50,24,0.35)' }} /></button>
          </div>
          <div className="space-y-2.5">
            {POINTS_RULES.map((r, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{r.icon}</span>
                  <div>
                    <p className="text-xs" style={{ color: 'rgba(65,50,24,0.65)' }}>{r.label}</p>
                    {r.note && <p className="text-xs font-medium" style={{ color: '#f7953f' }}>{r.note}</p>}
                  </div>
                </div>
                <span className="text-xs font-bold ml-2 flex-shrink-0" style={{ color: '#3D2C1C' }}>+{r.pts} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const LeaderboardRow = ({ entry, index, total }) => {
  const [expanded, setExpanded] = useState(false);
  const hasActivity = entry.content_done > 0 || entry.quizzes_passed > 0 || entry.courses_completed > 0;

  return (
    <div style={{
      background: entry.is_me ? 'rgba(247,149,63,0.05)' : index % 2 === 0 ? '#fff' : '#faf6ef',
      borderBottom: index < total - 1 ? '1px solid #f0e8de' : 'none',
      borderLeft: entry.is_me ? '3px solid #f7953f' : '3px solid transparent',
    }}>
      <div className="flex items-center gap-4 px-5 py-4">
        <span className="w-7 text-center font-bold text-sm flex-shrink-0"
          style={{ color: entry.rank <= 3 ? '#f7953f' : 'rgba(65,50,24,0.25)' }}>
          {MEDAL[entry.rank] || `#${entry.rank}`}
        </span>

        <Avatar url={entry.avatar_url} name={entry.name} size={38} />

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: '#3D2C1C' }}>
            {entry.name}
            {entry.is_me && (
              <span className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(247,149,63,0.12)', color: '#f7953f' }}>you</span>
            )}
          </p>
          {!hasActivity && (
            <p className="text-xs mt-0.5" style={{ color: 'rgba(65,50,24,0.3)' }}>No activity this week</p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {hasActivity && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-all"
              style={{ color: 'rgba(65,50,24,0.5)', background: 'rgba(65,50,24,0.05)', border: '1px solid rgba(65,50,24,0.1)' }}
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'Hide' : 'Details'}
            </button>
          )}
          <div className="text-right">
            <p className="font-bold text-lg leading-none" style={{ color: '#f7953f' }}>{entry.points}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(65,50,24,0.35)' }}>pts</p>
          </div>
        </div>
      </div>

      {expanded && hasActivity && (
        <div className="px-5 pb-4 pt-0">
          <BreakdownChips entry={entry} />
        </div>
      )}
    </div>
  );
};

const TeamLeaderboard = () => {
  const { teamId } = useParams();
  const [navCollapsed, setNavCollapsed] = useState(true);

  const { data: lb, isLoading: lbLoading } = useTeamLeaderboard(teamId, '7d');
  const { data: eng } = useTeamEngagement(teamId, '7d');

  const entries = lb?.entries || [];
  const top3 = entries.slice(0, 3);

  // Derived stats from leaderboard entries (always available once lb loads)
  const totalPoints = entries.reduce((s, e) => s + e.points, 0);
  const avgPoints = entries.length > 0 ? Math.round(totalPoints / entries.length) : 0;
  const topScore = entries[0]?.points ?? 0;
  const activeCount = entries.filter(e => e.points > 0).length;
  const participationPct = entries.length > 0 ? Math.round((activeCount / entries.length) * 100) : 0;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#faf6ef' }}>
      <EmployeeSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />

      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="w-full px-8 py-6 flex items-center justify-between flex-shrink-0"
          style={{ background: '#FAF6EF', borderBottom: '0.5px solid #63472d' }}>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2"
              style={{ color: '#3D2C1C', fontFamily: 'Georgia, serif' }}>
              <Trophy size={26} style={{ color: '#f7953f' }} /> Leaderboard
            </h1>
            <p style={{ color: 'rgba(65,50,24,0.45)', fontSize: 13, marginTop: 4 }}>
              Last 7 days · Team engagement & progress rankings
            </p>
          </div>
          <PointsLegendPopover />
        </div>

        <div className="px-8 py-6 max-w-5xl mx-auto space-y-5">

          {/* Top row: Summary left, Podium right */}
          <div className="flex gap-5 items-start">

            {/* Team Summary */}
            <div className="rounded-2xl p-5 flex-shrink-0 w-64" style={{ background: '#fff', border: '1px solid #e8e0d4' }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: 'rgba(65,50,24,0.35)' }}>Team Summary</p>
              <p className="text-xs mb-3" style={{ color: 'rgba(65,50,24,0.4)' }}>Last 7 days</p>
              <div className="space-y-3">
                <SummaryRow icon={<Users size={14} />}       label="Members"           value={eng?.total_members ?? entries.length} />
                <SummaryRow icon={<Zap size={14} />}         label="Active this week"  value={eng ? `${eng.active_learners} / ${eng.total_members}` : `${activeCount} / ${entries.length}`}
                  sub={eng
                    ? (eng.total_members > 0 ? `${Math.round(eng.active_learners / eng.total_members * 100)}% participation` : null)
                    : `${participationPct}% participation`} />
                <div style={{ borderTop: '1px solid #f0e8de', margin: '8px 0' }} />
                <SummaryRow icon={<FileText size={14} />}    label="Content completed" value={eng?.total_content_done ?? '—'} />
                <SummaryRow icon={<CheckCircle size={14} />} label="Quizzes passed"    value={eng?.quizzes_passed ?? '—'} />
                <SummaryRow icon={<BookOpen size={14} />}    label="Courses completed" value={eng?.courses_completed ?? '—'} />
                <div style={{ borderTop: '1px solid #f0e8de', margin: '8px 0' }} />
                <SummaryRow icon={<Trophy size={14} />}      label="Total pts earned"  value={totalPoints} sub={avgPoints > 0 ? `avg ${avgPoints} pts/member` : null} />
              </div>
            </div>

            {/* Podium */}
            <div className="flex-1 rounded-2xl p-6" style={{ background: '#fff', border: '1px solid #e8e0d4' }}>
              {lbLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 rounded-full border-2 animate-spin"
                    style={{ borderColor: '#e8e0d4', borderTopColor: '#f7953f' }} />
                </div>
              ) : entries.length === 0 ? (
                <div className="text-center py-16" style={{ color: 'rgba(65,50,24,0.35)' }}>
                  <Trophy size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No activity in the last 7 days</p>
                  <p className="text-sm mt-1">Complete content or pass a quiz to appear here</p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-5 text-center"
                    style={{ color: 'rgba(65,50,24,0.35)' }}>Top Performers</p>
                  <div className="flex items-end justify-center gap-3 max-w-xs mx-auto">
                    <PodiumCard entry={top3[1]} position={2} />
                    <PodiumCard entry={top3[0]} position={1} />
                    <PodiumCard entry={top3[2]} position={3} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Ranked list */}
          {!lbLoading && entries.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e8e0d4' }}>
              {entries.map((entry, i) => (
                <LeaderboardRow key={entry.user_id} entry={entry} index={i} total={entries.length} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamLeaderboard;
