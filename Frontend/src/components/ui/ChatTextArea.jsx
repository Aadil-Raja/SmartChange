// src/components/ui/ChatTextArea.jsx
import { forwardRef, useEffect } from 'react';

const ChatTextArea = forwardRef(({
  value,
  onChange,
  onKeyDown,
  placeholder = "Type your message...",
  disabled = false,
  className = "",
  maxRows = 5,
  maxLength = 2000,
  ...props
}, ref) => {
  // Auto-resize functionality
  useEffect(() => {
    if (ref?.current) {
      const textarea = ref.current;
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const lineHeight = 24; // Approximate line height
      const maxHeight = lineHeight * maxRows;
      textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }
  }, [value, maxRows]);

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={ref}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        rows={1}
        className={`
          w-full px-4 py-3 pr-12
          bg-white border-2 border-gray-200 rounded-xl
          text-gray-800 placeholder-gray-500
          resize-none overflow-hidden
          transition-all duration-200
          focus:outline-none focus:border-[#FDB913] focus:ring-2 focus:ring-[#FDB913]/20
          disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50
          ${disabled ? 'border-gray-100' : 'hover:border-gray-300'}
        `}
        style={{ 
          minHeight: '48px',
          lineHeight: '24px'
        }}
        {...props}
      />
      
      {/* Character count or other indicators can go here */}
      <div className="absolute bottom-2 right-3 text-xs text-gray-400">
        {disabled ? '🔒' : '💬'}
      </div>
    </div>
  );
});

ChatTextArea.displayName = 'ChatTextArea';

export default ChatTextArea;