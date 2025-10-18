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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220]">
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
            <label htmlFor="joinCode" className="mb-2 block text-sm font-medium text-gray-700">
              Join Code
            </label>
            <input
              type="text"
              id="joinCode"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl font-bold tracking-widest transition-colors focus:border-[#F58220] focus:outline-none focus:ring-2 focus:ring-[#F58220] focus:ring-opacity-20"
              required
            />
            <p className="mt-2 text-xs text-gray-500">
              Ask your team manager for the join code
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || joinCode.length !== 6}
              className="flex-1 rounded-lg bg-gradient-to-r from-[#FDB913] to-[#F58220] px-4 py-2.5 font-medium text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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