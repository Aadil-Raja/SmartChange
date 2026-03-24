import { useState } from 'react';
import { Menu, X, Home, Users, Settings, FileText, Eye, Edit2, Trash2 } from 'lucide-react';

const Textarea = ({ label, id, placeholder, value, onChange, required = false, rows = 4 }) => {
  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#333333]">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <textarea
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        rows={rows}
        className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-[#333333] transition-all duration-200 focus:border-[#f7953f] focus:outline-none focus:ring-2 focus:ring-[#f7953f]/20"
      />
    </div>
  );
};
export default Textarea;