// src/components/ui/LoadingSpinner.jsx
const LoadingSpinner = ({ 
  size = "md", 
  className = "", 
  variant = "primary",
  text = ""
}) => {
  const sizes = {
    xs: "h-3 w-3 border-2",
    small: "h-4 w-4 border-2",
    md: "h-8 w-8 border-3",
    large: "h-12 w-12 border-4",
    xl: "h-16 w-16 border-4"
  };

  const variants = {
    primary: "border-[#FDB913]/20 border-t-[#FDB913]",
    secondary: "border-gray-200 border-t-gray-600",
    white: "border-white/20 border-t-white",
    success: "border-green-200 border-t-green-600",
    error: "border-red-200 border-t-red-600"
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div
        className={`${sizes[size]} ${variants[variant]} rounded-full animate-spin`}
      />
      {text && (
        <p className="text-sm text-gray-600 font-medium animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;