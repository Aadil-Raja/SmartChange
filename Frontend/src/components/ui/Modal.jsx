import { useState } from 'react';
import { Menu, X, Home, Users, Settings, FileText, Eye, Edit2, Trash2 } from 'lucide-react';
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <Card className="w-full max-w-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#333333]">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
};
export default Modal;