// src/components/ui/ChatCard.jsx
import React from 'react';

const ChatCard = ({ 
  children, 
  className = '', 
  variant = 'default',
  padding = 'md',
  shadow = true,
  hover = false,
  onClick,
  ...props 
}) => {
  const variants = {
    default: 'bg-white border border-gray-200',
    primary: 'bg-gradient-to-br from-[#FDB913]/5 to-[#F58220]/5 border border-[#FDB913]/20',
    secondary: 'bg-gray-50 border border-gray-200',
    success: 'bg-green-50 border border-green-200',
    warning: 'bg-yellow-50 border border-yellow-200',
    error: 'bg-red-50 border border-red-200'
  };

  const paddings = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8'
  };

  const shadowClasses = shadow ? 'shadow-sm hover:shadow-md' : '';
  const hoverClasses = hover ? 'hover:scale-[1.02] cursor-pointer' : '';
  const clickableClasses = onClick ? 'cursor-pointer' : '';

  return (
    <div
      onClick={onClick}
      className={`
        rounded-xl transition-all duration-200
        ${variants[variant]}
        ${paddings[padding]}
        ${shadowClasses}
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

export default ChatCard;