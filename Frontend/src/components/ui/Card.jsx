import React from 'react';

const Card = ({ 
  children, 
  className = '', 
  variant = 'default',
  padding = 'md',
  shadow = 'md',
  hover = false,
  onClick,
  ...props 
}) => {
  const variants = {
    default: 'bg-white border border-gray-200',
    primary: 'bg-[rgba(245,130,32,0.05)] border border-[#F58220]/20',
    secondary: 'bg-gray-50 border border-gray-200',
    success: 'bg-green-50 border border-green-200',
    warning: 'bg-yellow-50 border border-yellow-200',
    error: 'bg-red-50 border border-red-200',
    glass: 'bg-white/95 backdrop-blur-sm border border-white/20'
  };

  const paddings = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8'
  };

  const shadows = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    '2xl': 'shadow-2xl'
  };

  const hoverClasses = hover ? 'hover:shadow-lg hover:scale-[1.02] cursor-pointer' : '';
  const clickableClasses = onClick ? 'cursor-pointer' : '';

  return (
    <div
      onClick={onClick}
      className={`
        rounded-xl transition-all duration-200
        ${variants[variant]}
        ${paddings[padding]}
        ${shadows[shadow]}
        ${hoverClasses}
        ${clickableClasses}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;