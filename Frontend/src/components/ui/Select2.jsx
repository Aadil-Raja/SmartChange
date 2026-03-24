// src/components/ui/Select2.jsx
import React from 'react';

const Select2 = ({ 
  label, 
  name,
  value, 
  onChange, 
  options, 
  required = false,
  disabled = false,
  helpText 
}) => {
  return (
    <div className="w-full">
      <label htmlFor={name} className="mb-2 block text-sm font-semibold text-[#333333]">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-[#333333] transition-all duration-200 focus:border-[#f7953f] focus:outline-none focus:ring-2 focus:ring-[#f7953f]/20 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {options.map((option, index) => (
          <option key={index} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helpText && (
        <p className="mt-1 text-sm text-gray-500">{helpText}</p>
      )}
    </div>
  );
};

export default Select2;