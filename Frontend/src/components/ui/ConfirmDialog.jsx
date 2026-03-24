// src/components/ui/ConfirmDialog.jsx
import { AlertTriangle } from "lucide-react";

const ConfirmDialog = ({
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "danger",
}) => {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
        {/* Content */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle size={22} className="text-red-500 flex-shrink-0 mt-0.5" />
            <h3 className="text-base font-bold text-[#1a1209]">{title}</h3>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed pl-8">{message}</p>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <button
            onClick={onCancel}
            className="px-5 py-2 rounded-full border border-[#f7953f] text-[#f7953f] text-sm font-semibold hover:bg-orange-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 rounded-full text-sm font-bold text-white transition-colors ${
              variant === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#f7953f] hover:bg-[#E0741C]"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
