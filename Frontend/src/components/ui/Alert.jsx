// src/components/ui/Alert.jsx
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

const Alert = ({
  children,
  variant = "info",
  onClose,
  className = "",
}) => {
  const variants = {
    success: {
      bg: "bg-green-50 border-green-200",
      text: "text-green-800",
      icon: <CheckCircle size={20} className="text-green-600" />,
    },
    error: {
      bg: "bg-red-50 border-red-200",
      text: "text-red-800",
      icon: <AlertCircle size={20} className="text-red-600" />,
    },
    warning: {
      bg: "bg-[#FDB913]/10 border-[#FDB913]/30",
      text: "text-[#FDB913]",
      icon: <AlertCircle size={20} className="text-[#FDB913]" />,
    },
    info: {
      bg: "bg-blue-50 border-blue-200",
      text: "text-blue-800",
      icon: <Info size={20} className="text-blue-600" />,
    },
  };

  const style = variants[variant];

  return (
    <div
      className={`${style.bg} ${style.text} border rounded-lg p-4 flex items-start gap-3 ${className}`}
    >
      <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
      <div className="flex-1 text-sm">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};

export default Alert;