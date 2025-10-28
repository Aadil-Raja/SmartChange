
import React, { forwardRef } from 'react';

const Input = forwardRef(({ 
  label, 
  type = 'text', 
  id, 
  placeholder, 
  value, 
  onChange, 
  required = false,
  disabled = false,
  error = '',
  helpText = '',
  className = '',
  size = 'md',
  variant = 'default',
  icon: Icon,
  ...props 
}, ref) => {
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  const variants = {
    default: 'border-gray-300 focus:border-[#FDB913] focus:ring-[#FDB913]',
    error: 'border-red-300 focus:border-red-500 focus:ring-red-500',
    success: 'border-green-300 focus:border-green-500 focus:ring-green-500'
  };

  const inputClasses = `
    w-full rounded-lg border transition-all duration-200
    text-gray-900 placeholder-gray-500
    focus:outline-none focus:ring-2 focus:ring-opacity-20
    disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50
    ${Icon ? 'pl-10' : ''}
    ${sizes[size]}
    ${variants[error ? 'error' : variant]}
    ${className}
  `;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon size={18} className="text-gray-400" />
          </div>
        )}
        
        <input
          ref={ref}
          type={type}
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className={inputClasses}
          {...props}
        />
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

Input.displayName = 'Input';

export default Input;