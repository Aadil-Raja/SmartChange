// Content List Component
import React from 'react';
import Card from './Card';
import { Eye, Edit2, Trash2 } from 'lucide-react';
import { FileText } from 'lucide-react';

// Content List Component
const ContentList = ({ items, onEdit, onDelete, onPreview }) => {
  return (
    <Card className="p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#FDB913] to-[#f7953f]">
            <FileText size={20} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[#333333]">Uploaded Documents</h2>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
          {items.length} {items.length === 1 ? 'Document' : 'Documents'}
        </span>
      </div>
      
      {items.length === 0 ? (
        <div className="py-12 text-center">
          <FileText size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No documents uploaded yet</p>
          <p className="mt-1 text-sm text-gray-400">Add your first document using the form above</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="border-b-2 border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-[#333333]">Document Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[#333333]">Description</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[#333333]">File Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[#333333]">Upload Date</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-[#333333]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-200 transition-colors hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm font-medium text-[#333333]">{item.name}</td>
                  <td className="px-4 py-4 text-sm text-gray-600">{item.description}</td>
                  <td className="px-4 py-4 text-sm text-gray-600">{item.fileName}</td>
                  <td className="px-4 py-4 text-sm text-gray-600">{item.uploadDate}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => onPreview(item)}
                        className="rounded-md p-2 text-[#00ADEF] transition-colors hover:bg-[#00ADEF]/10"
                        title="Preview"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => onEdit(item)}
                        className="rounded-md p-2 text-[#f7953f] transition-colors hover:bg-[#f7953f]/10"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
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
  );
};
export default ContentList;