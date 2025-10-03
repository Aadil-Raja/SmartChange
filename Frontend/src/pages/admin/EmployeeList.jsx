// Employee Form Modal
import React, { useState } from 'react';
import { Menu, Home, Users, Settings, FileText, Search, Plus, Eye, Edit2, Trash2 } from 'lucide-react';
import Sidebar from '../../components/ui/Sidebar';
import Modal from '../../components/ui/Modal';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';

const EmployeeFormModal = ({ isOpen, onClose, onSubmit, editingEmployee }) => {
  const [formData, setFormData] = useState(editingEmployee || {
    name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    status: 'Active'
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingEmployee ? 'Edit Employee' : 'Add New Employee'}>
      <div className="space-y-4">
        <Input
          label="Full Name"
          id="name"
          name="name"
          placeholder="Enter employee name"
          value={formData.name}
          onChange={handleChange}
          required
        />

        <Input
          label="Email"
          type="email"
          id="email"
          name="email"
          placeholder="Enter email address"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <Input
          label="Phone Number"
          type="tel"
          id="phone"
          name="phone"
          placeholder="Enter phone number"
          value={formData.phone}
          onChange={handleChange}
        />

        <Select
          label="Department"
          id="department"
          name="department"
          value={formData.department}
          onChange={handleChange}
          options={[
            { value: '', label: 'Select Department' },
            { value: 'Engineering', label: 'Engineering' },
            { value: 'HR', label: 'Human Resources' },
            { value: 'Finance', label: 'Finance' },
            { value: 'Operations', label: 'Operations' },
            { value: 'Marketing', label: 'Marketing' }
          ]}
          required
        />

        <Input
          label="Position"
          id="position"
          name="position"
          placeholder="Enter job position"
          value={formData.position}
          onChange={handleChange}
          required
        />

        <Select
          label="Status"
          id="status"
          name="status"
          value={formData.status}
          onChange={handleChange}
          options={[
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' },
            { value: 'On Leave', label: 'On Leave' }
          ]}
        />

        <div className="flex gap-3 pt-4">
          <Button onClick={handleSubmit} className="flex-1">
            {editingEmployee ? 'Update Employee' : 'Add Employee'}
          </Button>
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Employee Details Modal
const EmployeeDetailsModal = ({ isOpen, onClose, employee, onEdit }) => {
  if (!employee) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Employee Details">
      <div className="space-y-4">
        <div className="flex items-center justify-center pb-4">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] text-3xl font-bold text-white">
            {employee.name.charAt(0).toUpperCase()}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Full Name</p>
            <p className="text-lg font-semibold text-[#333333]">{employee.name}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Employee ID</p>
            <p className="text-lg font-semibold text-[#333333]">{employee.id}</p>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Email</p>
          <p className="rounded-lg bg-gray-50 p-3 text-[#333333]">{employee.email}</p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Phone Number</p>
          <p className="rounded-lg bg-gray-50 p-3 text-[#333333]">{employee.phone}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Department</p>
            <p className="rounded-lg bg-gray-50 p-3 text-[#333333]">{employee.department}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Position</p>
            <p className="rounded-lg bg-gray-50 p-3 text-[#333333]">{employee.position}</p>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
          <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
            employee.status === 'Active' ? 'bg-green-100 text-green-800' :
            employee.status === 'Inactive' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {employee.status}
          </span>
        </div>

        <div className="flex gap-3 pt-4">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            Close
          </Button>
          <Button onClick={() => {
            onEdit(employee);
            onClose();
          }} className="flex-1">
            Edit Employee
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Main Employee Management Page
const EmployeeManagement = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [employees, setEmployees] = useState([
    { id: 'EMP001', name: 'Ahmed Khan', email: 'ahmed.khan@ke.com', phone: '+92 300 1234567', department: 'Engineering', position: 'Senior Engineer', status: 'Active' },
    { id: 'EMP002', name: 'Sara Ali', email: 'sara.ali@ke.com', phone: '+92 301 2345678', department: 'HR', position: 'HR Manager', status: 'Active' },
    { id: 'EMP003', name: 'Bilal Ahmed', email: 'bilal.ahmed@ke.com', phone: '+92 302 3456789', department: 'Finance', position: 'Accountant', status: 'On Leave' },
    { id: 'EMP004', name: 'Fatima Malik', email: 'fatima.malik@ke.com', phone: '+92 303 4567890', department: 'Operations', position: 'Operations Lead', status: 'Active' },
    { id: 'EMP005', name: 'Hassan Raza', email: 'hassan.raza@ke.com', phone: '+92 304 5678901', department: 'Marketing', position: 'Marketing Executive', status: 'Inactive' }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Define navigation items for sidebar
  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/admin' },
    { icon: Users, label: 'Employees', path: '/admin/employees' },
    { icon: FileText, label: 'Documents', path: '/admin/documents' },
    { icon: Settings, label: 'Settings', path: '/admin/settings' }
  ];

  const currentPath = '/admin/employees';

  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         emp.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = !filterDepartment || emp.department === filterDepartment;
    const matchesStatus = !filterStatus || emp.status === filterStatus;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const handleAddEmployee = (employeeData) => {
    if (editingEmployee) {
      setEmployees(employees.map(emp => 
        emp.id === editingEmployee.id ? { ...employeeData, id: editingEmployee.id } : emp
      ));
      setEditingEmployee(null);
    } else {
      const newEmployee = {
        ...employeeData,
        id: `EMP${String(employees.length + 1).padStart(3, '0')}`
      };
      setEmployees([...employees, newEmployee]);
    }
  };

  const handleDeleteEmployee = (id) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      setEmployees(employees.filter(emp => emp.id !== id));
    }
  };

  const handleViewEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowDetailsModal(true);
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setShowAddModal(true);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterDepartment('');
    setFilterStatus('');
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
            <h1 className="text-xl font-bold text-[#333333]">Employee Management</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:block">Admin User</span>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FDB913] to-[#F58220] shadow-md" />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Search and Filter Section */}
            <Card className="p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#FDB913] to-[#F58220]">
                    <Search size={20} className="text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-[#333333]">Search & Filter</h2>
                </div>
                <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
                  <Plus size={18} />
                  <span className="hidden sm:inline">Add Employee</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by name, email, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-4 text-[#333333] transition-colors focus:border-[#FDB913] focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-opacity-20"
                  />
                </div>

                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="rounded-md border border-gray-300 px-4 py-2.5 text-[#333333] transition-colors focus:border-[#FDB913] focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-opacity-20"
                >
                  <option value="">All Departments</option>
                  <option value="Engineering">Engineering</option>
                  <option value="HR">Human Resources</option>
                  <option value="Finance">Finance</option>
                  <option value="Operations">Operations</option>
                  <option value="Marketing">Marketing</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-md border border-gray-300 px-4 py-2.5 text-[#333333] transition-colors focus:border-[#FDB913] focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-opacity-20"
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>

              {(searchQuery || filterDepartment || filterStatus) && (
                <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <p className="text-sm text-gray-600">
                    Showing {filteredEmployees.length} of {employees.length} employees
                  </p>
                  <button
                    onClick={resetFilters}
                    className="text-sm font-medium text-[#F58220] hover:text-[#FDB913]"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </Card>

            {/* Employee List */}
            <Card className="p-6 shadow-lg">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#FDB913] to-[#F58220]">
                    <Users size={20} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-[#333333]">All Employees</h2>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                  {filteredEmployees.length} {filteredEmployees.length === 1 ? 'Employee' : 'Employees'}
                </span>
              </div>

              {filteredEmployees.length === 0 ? (
                <div className="py-12 text-center">
                  <Users size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No employees found</p>
                  <p className="mt-1 text-sm text-gray-400">Try adjusting your search or filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="pb-3 text-left text-sm font-semibold text-[#333333]">ID</th>
                        <th className="pb-3 text-left text-sm font-semibold text-[#333333]">Name</th>
                        <th className="pb-3 text-left text-sm font-semibold text-[#333333]">Email</th>
                        <th className="pb-3 text-left text-sm font-semibold text-[#333333]">Department</th>
                        <th className="pb-3 text-left text-sm font-semibold text-[#333333]">Position</th>
                        <th className="pb-3 text-left text-sm font-semibold text-[#333333]">Status</th>
                        <th className="pb-3 text-center text-sm font-semibold text-[#333333]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((employee) => (
                        <tr key={employee.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50">
                          <td className="py-4 text-sm font-medium text-[#333333]">{employee.id}</td>
                          <td className="py-4 text-sm font-medium text-[#333333]">{employee.name}</td>
                          <td className="py-4 text-sm text-gray-600">{employee.email}</td>
                          <td className="py-4 text-sm text-gray-600">{employee.department}</td>
                          <td className="py-4 text-sm text-gray-600">{employee.position}</td>
                          <td className="py-4">
                            <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                              employee.status === 'Active' ? 'bg-green-100 text-green-800' :
                              employee.status === 'Inactive' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {employee.status}
                            </span>
                          </td>
                          <td className="py-4">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleViewEmployee(employee)}
                                className="rounded-md p-2 text-blue-600 transition-colors hover:bg-blue-50"
                                title="View Details"
                              >
                                <Eye size={18} />
                              </button>
                              <button
                                onClick={() => handleEditEmployee(employee)}
                                className="rounded-md p-2 text-[#F58220] transition-colors hover:bg-orange-50"
                                title="Edit"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                onClick={() => handleDeleteEmployee(employee.id)}
                                className="rounded-md p-2 text-red-600 transition-colors hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>

      {/* Add/Edit Employee Modal */}
      <EmployeeFormModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingEmployee(null);
        }}
        onSubmit={handleAddEmployee}
        editingEmployee={editingEmployee}
      />

      {/* Employee Details Modal */}
      <EmployeeDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        employee={selectedEmployee}
        onEdit={handleEditEmployee}
      />
    </div>
  );
};

export default EmployeeManagement;