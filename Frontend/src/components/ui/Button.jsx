import React, { useState } from 'react';

const Button = ({ children, onClick, type = 'button', className = '', disabled = false }) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-md bg-gradient-to-r from-[#FDB913] to-[#F58220] px-6 py-3 font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;