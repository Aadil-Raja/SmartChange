import { useState } from 'react';
import { X, UserPlus } from 'lucide-react';

const JoinTeamModal = ({ isOpen, onClose, onJoin, loading }) => {
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(joinCode)) {
      setError('Join code must be exactly 6 digits');
      return;
    }

    const result = await onJoin(joinCode);
    if (result.success) {
      setJoinCode('');
      onClose();
    } else {
      setError(result.message || 'Failed to join team');
    }
  };

  const handleClose = () => {
    setJoinCode('');
    setError('');
    onClose();
  };

  const inputStyle = {
    width: '100%',
    borderRadius: '12px',
    border: '1.5px solid #e0d8ce',
    background: 'white',
    color: '#1a1209',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(26,18,9,0.55)', backdropFilter: 'blur(2px)' }}>
      <div className="w-full bg-white" style={{ maxWidth: '520px', borderRadius: '20px', boxShadow: '0 24px 64px rgba(26,18,9,0.22)' }}>
        <div className="flex items-center justify-between px-7 pt-6 pb-5" style={{ borderBottom: '1px solid #f0ebe3' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fff0e8', color: '#f7953f' }}>
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold" style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}>Join Team</h2>
              <p className="text-xs" style={{ color: '#9c8e80' }}>Enter the 6-digit join code</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{ background: '#f3ede4', color: '#6b5e4e' }}
            aria-label="Close modal"
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2c8'; e.currentTarget.style.color = '#f7953f'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f3ede4'; e.currentTarget.style.color = '#6b5e4e'; }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6">
          {error && (
            <div className="mb-4 rounded-xl border p-3 text-sm" style={{ background: '#fff5f5', borderColor: '#fecaca', color: '#b91c1c' }}>
              {error}
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="joinCode" className="mb-2 block text-sm font-semibold" style={{ color: '#3d3228' }}>
              Join Code <span style={{ color: '#f7953f' }}>*</span>
            </label>
            <input
              type="text"
              id="joinCode"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="px-4 py-3 text-center text-2xl font-bold tracking-widest"
              style={inputStyle}
              onFocus={(e) => {
                e.target.style.borderColor = '#f7953f';
                e.target.style.boxShadow = '0 0 0 3px rgba(245,130,32,0.12)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e0d8ce';
                e.target.style.boxShadow = 'none';
              }}
              required
            />
            <p className="mt-2 text-xs" style={{ color: '#9c8e80' }}>
              Ask your team manager for the join code
            </p>
          </div>

          <div className="flex justify-end gap-3" style={{ borderTop: '1px solid #f0ebe3', paddingTop: '20px' }}>
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 rounded-full text-sm font-semibold border transition-all"
              style={{ borderColor: '#d0c8be', color: '#6b5e4e', background: 'white' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || joinCode.length !== 6}
              className="px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#f7953f' }}
            >
              {loading ? 'Joining...' : 'Join Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinTeamModal;
