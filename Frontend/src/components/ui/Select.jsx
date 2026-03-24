
import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(({ 
  label, 
  id, 
  value, 
  onChange, 
  options = [], 
  required = false,
  disabled = false,
  placeholder = 'Select an option...',
  error = '',
  helpText = '',
  className = '',
  size = 'md',
  variant = 'default',
  ...props 
}, ref) => {
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-3 py-2.5 text-sm',
    lg: 'px-3 py-3 text-base'
  };

  const variants = {
    default: 'border-gray-300 focus:border-[#f7953f] focus:ring-[#f7953f]/20',
    error: 'border-red-300 focus:border-red-500 focus:ring-red-500/20',
    success: 'border-green-300 focus:border-green-500 focus:ring-green-500/20'
  };

  const selectClasses = `
    w-full rounded-md border transition-all duration-200 appearance-none
    text-gray-900 bg-white pr-10
    focus:outline-none focus:ring-2
    disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50
    ${sizes[size]}
    ${variants[error ? 'error' : variant]}
    ${className}
  `;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#333333]">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <select
          ref={ref}
          id={id}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className={selectClasses}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option, index) => (
            <option key={option.value || index} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <ChevronDown size={18} className="text-gray-400" />
        </div>
      </div>
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      
      {helpText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helpText}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;