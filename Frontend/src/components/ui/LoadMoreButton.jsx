// src/components/ui/LoadMoreButton.jsx
import { ChevronDown, Loader2 } from 'lucide-react';

const LoadMoreButton = ({ 
  onClick, 
  loading = false, 
  hasMore = true, 
  text = 'Load More',
  loadingText = 'Loading...',
  noMoreText = 'No more items',
  className = '',
  variant = 'secondary'
}) => {
  if (!hasMore) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <span className="text-sm text-gray-500 italic">{noMoreText}</span>
      </div>
    );
  }

  const baseClasses = "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: "bg-[#f7953f] text-white hover:bg-[#E0741C] shadow-sm hover:shadow-md",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300",
    outline: "bg-white text-[#f7953f] border-2 border-[#f7953f] hover:bg-[#f7953f] hover:text-white"
  };

  return (
    <div className={`text-center py-4 ${className}`}>
      <button
        onClick={onClick}
        disabled={loading}
        className={`${baseClasses} ${variantClasses[variant]}`}
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>{loadingText}</span>
          </>
        ) : (
          <>
            <ChevronDown size={18} />
            <span>{text}</span>
          </>
        )}
      </button>
    </div>
  );
};

export default LoadMoreButton;
