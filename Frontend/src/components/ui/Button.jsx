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
    primary: 'bg-[#f7953f] text-white hover:bg-[#E0741C] shadow-md hover:shadow-lg',
    secondary: 'bg-white text-[#f7953f] border-2 border-[#f7953f] hover:bg-[#f7953f] hover:text-white shadow-md hover:shadow-lg',
    gradient: 'bg-gradient-to-r from-[#FDB913] to-[#f7953f] text-white hover:from-[#E5A50F] hover:to-[#E0741C] shadow-lg hover:shadow-xl',
    ghost: 'bg-transparent text-[#f7953f] hover:bg-[#f7953f]/10',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-md hover:shadow-lg',
    success: 'bg-[#78BE20] text-white hover:bg-[#6AAD1C] shadow-md hover:shadow-lg',
    dark: 'bg-gray-800 text-white hover:bg-gray-900 shadow-md hover:shadow-lg'
  };

  const sizes = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-6 text-base'
  };

  const baseClasses = `
    inline-flex items-center justify-center gap-2 
    rounded-lg font-semibold transition-all duration-200 
    focus:outline-none focus:ring-2 focus:ring-[#f7953f]/50 focus:ring-offset-2 
    disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none
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