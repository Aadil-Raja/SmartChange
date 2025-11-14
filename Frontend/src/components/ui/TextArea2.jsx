// src/components/ui/TextArea.jsx
const TextArea2 = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  rows = 4,
  className = "",
  helpText,
  ...props
}) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-semibold text-[#333333] mb-2"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F58220]/20 focus:border-[#F58220] disabled:bg-gray-100 disabled:cursor-not-allowed resize-y transition-all duration-200"
        {...props}
      />
      {helpText && (
        <p className="mt-1 text-sm text-gray-500">{helpText}</p>
      )}
    </div>
  );
};

export default TextArea2;