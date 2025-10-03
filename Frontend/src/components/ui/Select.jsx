

const Select = ({ label, id, value, onChange, options, required = false }) => {
  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-[#333333]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-md border border-gray-300 px-4 py-2.5 text-[#333333] transition-colors focus:border-[#FDB913] focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-opacity-20"
      >
        {options.map((option, index) => (
          <option key={index} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
export default Select;