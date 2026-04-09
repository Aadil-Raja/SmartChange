import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTeamLeaderboard, useTeamEngagement } from '../../hooks/useEmployeeQueries';
import EmployeeSidebar from '../../components/ui/EmployeeSidebar';
import { Trophy, Users, FileText, CheckCircle, Zap } from 'lucide-react';

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

  if (chips.length === 0)
    return <p className="text-xs mt-0.5" style={{ color: 'rgba(65,50,24,0.3)' }}>No activity this week</p>;

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
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

const TeamLeaderboard = () => {
  const { teamId } = useParams();
  const [navCollapsed, setNavCollapsed] = useState(true);

  const { data: lb, isLoading: lbLoading } = useTeamLeaderboard(teamId, '7d');
  const { data: eng } = useTeamEngagement(teamId, '7d');

  const entries = lb?.entries || [];
  const top3 = entries.slice(0, 3);

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
        </div>

        <div className="px-8 py-6 max-w-4xl mx-auto space-y-5">

          {/* Engagement stats */}
          {eng && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={Users}        label="Team Members"            value={eng.total_members} />
              <StatCard icon={Zap}          label="Active Learners"         value={eng.active_learners}
                sub={eng.total_members > 0 ? `${Math.round(eng.active_learners / eng.total_members * 100)}% of team` : null} />
              <StatCard icon={FileText}     label="Content Items Completed" value={eng.total_content_done} />
              <StatCard icon={CheckCircle}  label="Quizzes Passed"          value={eng.quizzes_passed} />
            </div>
          )}

          {/* Points legend */}
          <div className="rounded-xl px-5 py-4" style={{ background: '#fff', border: '1px solid #e8e0d4' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'rgba(65,50,24,0.35)' }}>How points are earned</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {POINTS_RULES.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">{r.icon}</span>
                  <div>
                    <p className="text-xs font-bold" style={{ color: '#3D2C1C' }}>+{r.pts} pts</p>
                    <p className="text-xs leading-snug" style={{ color: 'rgba(65,50,24,0.5)' }}>{r.label}</p>
                    {r.note && <p className="text-xs font-medium" style={{ color: '#f7953f' }}>{r.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {lbLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: '#e8e0d4', borderTopColor: '#f7953f' }} />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20" style={{ color: 'rgba(65,50,24,0.35)' }}>
              <Trophy size={48} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">No activity in the last 7 days</p>
              <p className="text-sm mt-1">Complete content or pass a quiz to appear here</p>
            </div>
          ) : (
            <>
              {/* Podium */}
              {entries.length >= 2 && (
                <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid #e8e0d4' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-5 text-center"
                    style={{ color: 'rgba(65,50,24,0.35)' }}>Top Performers</p>
                  <div className="flex items-end justify-center gap-3 max-w-xs mx-auto">
                    <PodiumCard entry={top3[1]} position={2} />
                    <PodiumCard entry={top3[0]} position={1} />
                    <PodiumCard entry={top3[2]} position={3} />
                  </div>
                </div>
              )}

              {/* Ranked list */}
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e8e0d4' }}>
                {entries.map((entry, i) => (
                  <div key={entry.user_id}
                    className="flex items-start gap-4 px-5 py-4"
                    style={{
                      background: entry.is_me ? 'rgba(247,149,63,0.05)' : i % 2 === 0 ? '#fff' : '#faf6ef',
                      borderBottom: i < entries.length - 1 ? '1px solid #f0e8de' : 'none',
                      borderLeft: entry.is_me ? '3px solid #f7953f' : '3px solid transparent',
                    }}>

                    <span className="w-7 text-center font-bold text-sm flex-shrink-0 mt-1"
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
                      <BreakdownChips entry={entry} />
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <p className="font-bold text-lg leading-none" style={{ color: '#f7953f' }}>{entry.points}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(65,50,24,0.35)' }}>pts</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamLeaderboard;
