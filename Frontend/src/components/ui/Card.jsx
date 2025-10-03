import React, { useState } from 'react';

const Card = ({ children, className = '' }) => {
  return (
    <div className={`rounded-lg bg-white shadow-xl ${className}`}>
      {children}
    </div>
  );
};

export default Card;