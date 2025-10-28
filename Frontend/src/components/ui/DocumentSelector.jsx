// src/components/chatbot/DocumentSelector.jsx
import { useEffect, useState } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import { X, FileText, Check, Search, RefreshCw } from "lucide-react";
import Button from "../ui/Button";
import LoadingSpinner from "../ui/LoadingSpinner";
import Input from "../ui/Input";

const DocumentSelector = ({ onClose }) => {
  const {
    availableDocuments,
    selectedDocumentId,
    loading,
    selectDocument,
    fetchDocuments,
  } = useChatbot();

  const [searchQuery, setSearchQuery] = useState("");
  const [localSelection, setLocalSelection] = useState(selectedDocumentId);

  useEffect(() => {
    if (availableDocuments.length === 0) {
      fetchDocuments();
    }
  }, []);

  const filteredDocuments = availableDocuments.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (documentId) => {
    setLocalSelection(documentId);
  };

  const handleConfirm = () => {
    if (localSelection) {
      selectDocument(localSelection);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                <FileText size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Select Document</h2>
                <p className="text-white/80 text-sm mt-1">
                  Choose a document to chat with
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="pl-10 bg-white/20 backdrop-blur-sm border-white/30 text-white placeholder-white/60"
            />
          </div>
        </div>

        {/* Document List */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {loading && availableDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingSpinner size="large" />
              <p className="mt-4 text-gray-600">Loading documents...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={64} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                {searchQuery ? "No documents found" : "No processed documents"}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery
                  ? "Try a different search term"
                  : "Upload and process documents to get started"}
              </p>
              {!searchQuery && (
                <Button
                  onClick={fetchDocuments}
                  variant="outline"
                  className="flex items-center gap-2 mx-auto"
                >
                  <RefreshCw size={18} />
                  Refresh List
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((doc) => {
                const isSelected = localSelection === doc.id;
                const isCurrentlyActive = selectedDocumentId === doc.id;

                return (
                  <div
                    key={doc.id}
                    onClick={() => handleSelect(doc.id)}
                    className={`group relative p-4 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? "bg-gradient-to-r from-indigo-100 to-purple-100 border-2 border-indigo-400 shadow-md"
                        : "bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                          isSelected
                            ? "bg-gradient-to-br from-indigo-500 to-purple-500"
                            : "bg-gray-200 group-hover:bg-gray-300"
                        }`}
                      >
                        <FileText
                          size={24}
                          className={isSelected ? "text-white" : "text-gray-600"}
                        />
                      </div>

                      {/* Document Info */}
                      <div className="flex-1 min-w-0">
                        <h3
                          className={`font-semibold mb-1 truncate ${
                            isSelected ? "text-indigo-900" : "text-gray-900"
                          }`}
                        >
                          {doc.title}
                        </h3>
                        {isCurrentlyActive && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                            <Check size={12} />
                            Currently Active
                          </span>
                        )}
                      </div>

                      {/* Selection Indicator */}
                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600"
                            : "border-gray-300 group-hover:border-gray-400"
                        }`}
                      >
                        {isSelected && <Check size={16} className="text-white" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 bg-gray-50 border-t">
          <Button variant="outline" onClick={onClose} className="px-6">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!localSelection}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 shadow-lg"
          >
            <Check size={18} />
            <span className="ml-2 font-semibold">Confirm Selection</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DocumentSelector;