import { useState } from 'react';
import { X, UserPlus } from 'lucide-react';

const JoinTeamModal = ({ isOpen, onClose, onJoin, loading }) => {
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate join code (6 digits)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#f7953f]"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-[#FDB913] to-[#f7953f]">
            <UserPlus size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#333333]">Join Team</h2>
            <p className="text-sm text-gray-600">Enter the 6-digit join code</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="joinCode" className="mb-2 block text-sm font-semibold text-[#333333]">
              Join Code
            </label>
            <input
              type="text"
              id="joinCode"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full rounded-md border border-gray-300 px-4 py-3 text-center text-2xl font-bold tracking-widest transition-colors focus:border-[#f7953f] focus:outline-none focus:ring-2 focus:ring-[#f7953f]/20"
              required
            />
            <p className="mt-2 text-xs text-gray-500">
              Ask your team manager for the join code
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 h-10 rounded-md border border-[#f7953f] px-4 font-medium text-[#f7953f] transition-colors hover:bg-[#f7953f] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || joinCode.length !== 6}
              className="flex-1 h-10 rounded-md bg-[#f7953f] px-4 font-medium text-white transition-all hover:bg-[#E0741C] disabled:cursor-not-allowed disabled:opacity-50"
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