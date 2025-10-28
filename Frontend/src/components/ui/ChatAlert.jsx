

const Alert = ({ children, variant = 'info', onClose }) => {
  const variants = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 ${variants[variant]} animate-in slide-in-from-top duration-300`}>
      <span className="font-medium">{children}</span>
      {onClose && (
        <button onClick={onClose} className="ml-4 hover:opacity-70">
          <X size={18} />
        </button>
      )}
    </div>
  );
};