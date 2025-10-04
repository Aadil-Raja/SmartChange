import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut } from 'lucide-react';

const LogoutButton = ({ variant = 'default', showIcon = true, className = '' }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  };

  const variants = {
    default: 'flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600',
    ghost: 'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100',
    sidebar: 'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white'
  };

  return (
    <button
      onClick={handleLogout}
      className={`${variants[variant]} ${className}`}
    >
      {showIcon && <LogOut size={18} />}
      <span>Logout</span>
    </button>
  );
};

export default LogoutButton;