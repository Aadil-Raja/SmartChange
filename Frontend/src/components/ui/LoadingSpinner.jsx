// src/components/ui/LoadingSpinner.jsx
const LoadingSpinner = ({ size = "md", className = "" }) => {
  const sizes = {
    small: "h-4 w-4 border-2",
    md: "h-8 w-8 border-3",
    large: "h-12 w-12 border-4",
  };

  return (
    <div
      className={`${sizes[size]} border-indigo-200 border-t-indigo-600 rounded-full animate-spin ${className}`}
    />
  );
};

export default LoadingSpinner;