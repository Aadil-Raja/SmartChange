import { ChevronLeft, ChevronRight } from 'lucide-react';
import LogoutButton from './LogoutButton';


const Sidebar = ({ isOpen, isCollapsed, onToggle, onCollapse, navItems, currentPath }) => {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-30 h-full transform bg-[#333333] text-white transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-gray-700">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220]">
            <span className="text-xl font-bold">KE</span>
          </div>
          {!isCollapsed && <span className="ml-3 text-xl font-bold">Admin Panel</span>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 mt-6 px-3">
          {navItems.map((item, index) => {
            const isActive = currentPath === item.path;
            return (
              <a
                key={index}
                href={item.path}
                className={`mb-2 flex items-center rounded-lg px-4 py-3 transition-all duration-200 ${isActive
                    ? 'bg-gradient-to-r from-[#FDB913] to-[#F58220] text-white shadow-lg'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white hover:shadow-md'
                  }`}
                title={isCollapsed ? item.label : ''}
              >
                <item.icon size={20} className="flex-shrink-0" />
                {!isCollapsed && <span className="ml-3 font-medium">{item.label}</span>}
              </a>
            );
          })}
        </nav>

        {/* Logout at bottom of sidebar */}
        <div className="px-3 pb-6">
          <LogoutButton variant="sidebar" showIcon={!isCollapsed} />
        </div>

        {/* Collapse Toggle Button (Desktop Only) */}
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 transform rounded-lg bg-gradient-to-r from-[#FDB913] to-[#F58220] p-2 text-white transition-all hover:shadow-lg lg:block"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        )}
      </aside>
    </>
  );
};
export default Sidebar;