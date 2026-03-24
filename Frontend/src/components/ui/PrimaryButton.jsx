// src/components/ui/PrimaryButton.jsx
import React from 'react';

const PrimaryButton = ({ 
  children, 
  onClick, 
  type = 'button', 
  className = '', 
  disabled = false,
  variant = 'primary',
  size = 'md',
  ...props 
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-[#FDB913] to-[#f7953f] text-white hover:from-[#E5A50F] hover:to-[#E0741C] shadow-lg hover:shadow-xl',
    secondary: 'bg-white text-[#FDB913] border-2 border-[#FDB913] hover:bg-[#FDB913] hover:text-white',
    outline: 'bg-transparent text-[#FDB913] border-2 border-[#FDB913] hover:bg-[#FDB913] hover:text-white',
    ghost: 'bg-transparent text-[#FDB913] hover:bg-[#FDB913]/10',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 
        rounded-lg font-semibold transition-all duration-200 
        focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-offset-2 
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

export default PrimaryButton;