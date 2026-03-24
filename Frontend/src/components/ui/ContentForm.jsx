import React, { useState } from 'react';
import Card from './Card';
import Input from './Input';
import Textarea from './Textarea';
import Button from './Button';
import { FileText } from 'lucide-react';

// Content Form Component
const ContentForm = ({ onSubmit, editingItem, onCancel }) => {
  const [documentName, setDocumentName] = useState(editingItem?.name || '');
  const [description, setDescription] = useState(editingItem?.description || '');
  const [fileName, setFileName] = useState(editingItem?.fileName || '');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!documentName.trim()) {
      alert('Please enter a document name');
      return;
    }
    onSubmit({
      id: editingItem?.id || Date.now(),
      name: documentName,
      description: description || 'No description',
      fileName: fileName || 'No file selected',
      uploadDate: editingItem?.uploadDate || new Date().toLocaleDateString()
    });
    setDocumentName('');
    setDescription('');
    setFileName('');
  };

  return (
    <Card className="p-6 shadow-lg">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#FDB913] to-[#f7953f]">
          <FileText size={20} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-[#333333]">
          {editingItem ? 'Edit Content' : 'Add New Content'}
        </h2>
      </div>
      <div className="space-y-4">
        <Input
          label="Document Name"
          id="documentName"
          placeholder="Enter document name"
          value={documentName}
          onChange={(e) => setDocumentName(e.target.value)}
          required
        />

        <Textarea
          label="Description"
          id="description"
          placeholder="Enter description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div className="w-full">
          <label className="mb-2 block text-sm font-medium text-[#333333]">
            File Upload
          </label>
          <input
            type="file"
            onChange={handleFileChange}
            className="w-full rounded-md border border-gray-300 px-4 py-2.5 text-[#333333] transition-colors file:mr-4 file:rounded-md file:border-0 file:bg-gradient-to-r file:from-[#FDB913] file:to-[#f7953f] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:opacity-90 focus:border-[#FDB913] focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-opacity-20"
          />
          {fileName && (
            <p className="mt-2 text-sm text-green-600">✓ Selected: {fileName}</p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSubmit} className="flex-1">
            {editingItem ? 'Update Content' : 'Add Content'}
          </Button>
          {editingItem && (
            <Button onClick={onCancel} variant="secondary">
              Cancel
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
export default ContentForm;