import React from 'react';

const Button = ({ 
  children, 
  onClick, 
  type = 'button', 
  className = '', 
  disabled = false,
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  loading = false,
  ...props 
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-[#FDB913] to-[#F58220] text-white hover:from-[#E5A50F] hover:to-[#E0741C] shadow-lg hover:shadow-xl',
    secondary: 'bg-white text-[#FDB913] border-2 border-[#FDB913] hover:bg-[#FDB913] hover:text-white shadow-md hover:shadow-lg',
    outline: 'bg-transparent text-[#FDB913] border-2 border-[#FDB913] hover:bg-[#FDB913] hover:text-white shadow-sm hover:shadow-md',
    ghost: 'bg-transparent text-[#FDB913] hover:bg-[#FDB913]/10 hover:text-[#E5A50F]',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-xl',
    success: 'bg-green-500 text-white hover:bg-green-600 shadow-lg hover:shadow-xl',
    dark: 'bg-gray-800 text-white hover:bg-gray-900 shadow-lg hover:shadow-xl'
  };

  const sizes = {
    xs: 'px-2.5 py-1.5 text-xs',
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg'
  };

  const baseClasses = `
    inline-flex items-center justify-center gap-2 
    rounded-lg font-semibold transition-all duration-200 
    focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-offset-2 
    disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none
    transform hover:scale-[1.02] active:scale-[0.98]
    ${fullWidth ? 'w-full' : ''}
    ${variants[variant]} 
    ${sizes[size]} 
    ${className}
  `;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={baseClasses}
      {...props}
    >
      {loading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
};

export default Button;