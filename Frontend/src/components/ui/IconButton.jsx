// src/components/ui/IconButton.jsx
import React from 'react';

const IconButton = ({ 
  children, 
  onClick, 
  className = '', 
  disabled = false,
  variant = 'primary',
  size = 'md',
  tooltip,
  ...props 
}) => {
  const variants = {
    primary: 'bg-[#f7953f] text-white hover:bg-[#E0741C] shadow-md hover:shadow-lg',
    secondary: 'bg-white text-[#f7953f] border-2 border-[#f7953f] hover:bg-[#f7953f] hover:text-white shadow-md hover:shadow-lg',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-[#f7953f]',
    danger: 'bg-transparent text-red-500 hover:bg-red-50 hover:text-red-600'
  };

  const sizes = {
    sm: 'w-8 h-8 p-1.5',
    md: 'w-10 h-10 p-2.5',
    lg: 'w-12 h-12 p-3',
    xl: 'w-14 h-14 p-3.5'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={`
        inline-flex items-center justify-center
        rounded-lg font-medium transition-all duration-200 
        focus:outline-none focus:ring-2 focus:ring-[#f7953f]/50 focus:ring-offset-2 
        disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none
        ${variants[variant]} 
        ${sizes[size]} 
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

export default IconButton;