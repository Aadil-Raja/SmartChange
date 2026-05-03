import { useEffect } from 'react';
import { AlertTriangle, LogOut, X } from 'lucide-react';

const LogoutConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm logout',
  message = 'You will be signed out of this session and returned to the login screen.',
  confirmLabel = 'Logout',
}) => {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-[rgba(232,146,42,0.16)] bg-[#faf6ef] shadow-[0_28px_80px_rgba(14,11,7,0.28)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#2b1e13] via-[#271a10] to-[#1c120b] px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(250,246,239,0.12)] text-[rgba(250,246,239,0.62)] transition-colors hover:bg-[rgba(250,246,239,0.08)] hover:text-[#f7953f]"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-4 pr-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(245,130,32,0.36)] bg-[rgba(245,130,32,0.14)] text-[#f7953f] shadow-[0_0_0_6px_rgba(245,130,32,0.08)]">
              <AlertTriangle size={22} strokeWidth={2} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[rgba(250,246,239,0.45)]">Session action</p>
              <h2 className="mt-1 font-[var(--font-display)] text-[28px] font-bold tracking-[-0.04em] text-[#faf6ef]">
                {title}
              </h2>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <p className="text-[14px] leading-6 text-[rgba(14,11,7,0.72)]">
            {message}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[rgba(14,11,7,0.12)] bg-white px-4 py-3 text-[14px] font-semibold text-[rgba(14,11,7,0.78)] shadow-[0_2px_10px_rgba(14,11,7,0.06)] transition-all hover:border-[rgba(232,146,42,0.24)] hover:bg-[rgba(247,242,233,0.9)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[rgba(192,57,43,0.2)] bg-[#1c120b] px-4 py-3 text-[14px] font-semibold text-[#faf6ef] shadow-[0_12px_24px_rgba(14,11,7,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#2e1c12] hover:shadow-[0_16px_30px_rgba(14,11,7,0.22)]"
            >
              <LogOut size={16} />
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoutConfirmModal;
