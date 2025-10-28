

const ChatInput = ({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  className = '',
  icon: Icon,
  ...props 
}) => {
  return (
    <div className="relative">
      {Icon && (
        <Icon size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
      )}
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all ${className}`}
        {...props}
      />
    </div>
  );
};