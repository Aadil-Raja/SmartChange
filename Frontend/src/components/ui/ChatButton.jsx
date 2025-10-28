

// ==================== BUTTON COMPONENT ====================

const ChatButton = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  disabled = false, 
  className = '',
  ...props 
}) => {
  const baseStyles = "flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 shadow-lg hover:shadow-xl transform hover:scale-105",
    secondary: "bg-white border-2 border-yellow-400 text-gray-900 hover:bg-yellow-50",
    ghost: "bg-transparent hover:bg-yellow-50 text-gray-700",
    danger: "bg-red-500 hover:bg-red-600 text-white"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
