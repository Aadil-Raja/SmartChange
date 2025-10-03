
import React, { useState } from 'react';

const Input = ({ label, type = 'text', id, placeholder, value, onChange, required = false }) => {
  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-[#333333]">
        {label}
      </label>
      <input
        type={type}
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-md border border-gray-300 px-4 py-2.5 text-[#333333] transition-colors focus:border-[#FDB913] focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-opacity-20"
      />
    </div>
  );
};

export default Input;