// src/components/ui/MobileSidebarToggle.jsx
import React from 'react';
import { Menu, X } from 'lucide-react';
import IconButton from './IconButton';

const MobileSidebarToggle = ({ isOpen, onToggle, className = '' }) => {
  return (
    <div className={`md:hidden ${className}`}>
      <IconButton
        onClick={onToggle}
        variant="ghost"
        size="md"
        className="text-gray-600 hover:text-[#FDB913] hover:bg-[#FDB913]/10"
        tooltip={isOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </IconButton>
    </div>
  );
};

export default MobileSidebarToggle;