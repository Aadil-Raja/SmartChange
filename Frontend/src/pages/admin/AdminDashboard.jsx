// Main Admin Dashboard
import React, { useState } from 'react';
import { Menu, Home, Users, Settings, FileText } from 'lucide-react';
import Sidebar from '../../components/ui/Sidebar';
import ContentForm from '../../components/ui/ContentForm';
import ContentList from '../../components/ui/ContentList';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contents, setContents] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);

  // Define navigation items for sidebar
  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/admin' },
    { icon: FileText, label: 'Employees', path: '/admin/employees' },
    { icon: Users, label: 'Users', path: '/admin/users' },
    { icon: Settings, label: 'Settings', path: '/admin/settings' }
  ];

  // Current path (you can use useLocation from react-router-dom in real app)
  const currentPath = '/admin';

  const handleAddContent = (content) => {
    if (editingItem) {
      setContents(contents.map(item => item.id === content.id ? content : item));
      setEditingItem(null);
    } else {
      setContents([...contents, content]);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      setContents(contents.filter(item => item.id !== id));
    }
  };

  const handlePreview = (item) => {
    setPreviewItem(item);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Sidebar 
        isOpen={sidebarOpen} 
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        navItems={navItems}
        currentPath={currentPath}
      />

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-[#333333] transition-colors hover:text-[#FDB913] lg:hidden"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-[#333333]">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:block">Admin User</span>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-md" />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <ContentForm
              onSubmit={handleAddContent}
              editingItem={editingItem}
              onCancel={handleCancelEdit}
            />
            <ContentList
              items={contents}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPreview={handlePreview}
            />
          </div>
        </main>
      </div>

      {/* Preview Modal */}
      <Modal
        isOpen={!!previewItem}
        onClose={() => setPreviewItem(null)}
        title="Document Preview"
      >
        {previewItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Document Name</p>
                <p className="text-lg font-semibold text-[#333333]">{previewItem.name}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Upload Date</p>
                <p className="text-lg font-semibold text-[#333333]">{previewItem.uploadDate}</p>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Description</p>
              <p className="rounded-lg bg-gray-50 p-3 text-[#333333]">{previewItem.description}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">File Name</p>
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
                <FileText size={20} className="text-gray-400" />
                <p className="font-medium text-[#333333]">{previewItem.fileName}</p>
              </div>
            </div>
            <div className="mt-6 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <FileText size={64} className="mx-auto mb-4 text-gray-300" />
              <p className="font-medium text-gray-600">File Preview</p>
              <p className="mt-2 text-sm text-gray-500">
                Preview functionality would display file content here
              </p>
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={() => setPreviewItem(null)} variant="secondary" className="flex-1">
                Close
              </Button>
              <Button onClick={() => {
                handleEdit(previewItem);
                setPreviewItem(null);
              }} className="flex-1">
                Edit Document
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminDashboard;