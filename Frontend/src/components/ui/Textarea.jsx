import { useState } from 'react';
import { Menu, X, Home, Users, Settings, FileText, Eye, Edit2, Trash2 } from 'lucide-react';

const Textarea = ({ label, id, placeholder, value, onChange, required = false, rows = 4 }) => {
  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-[#333333]">
        {label}
      </label>
      <textarea
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        rows={rows}
        className="w-full rounded-md border border-gray-300 px-4 py-2.5 text-[#333333] transition-colors focus:border-[#FDB913] focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-opacity-20"
      />
    </div>
  );
};
export default Textarea;