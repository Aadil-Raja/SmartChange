// src/components/ui/DocumentSelector.jsx
import { useEffect, useState } from "react";
import { useChatbot } from "../../hooks/useChatbot";
import { X, FileText, Check, Search, RefreshCw, Sparkles } from "lucide-react";
import PrimaryButton from "./PrimaryButton";
import IconButton from "./IconButton";
import ChatCard from "./ChatCard";
import StatusBadge from "./StatusBadge";
import LoadingSpinner from "./LoadingSpinner";
import Input from "./Input";

const DocumentSelector = ({ onClose }) => {
  const {
    availableDocuments,
    selectedDocumentIds,
    loading,
    selectDocument,
    fetchDocuments,
  } = useChatbot();

  const [searchQuery, setSearchQuery] = useState("");
  const [localSelection, setLocalSelection] = useState(selectedDocumentIds || []);

  useEffect(() => {
    if (availableDocuments.length === 0) {
      fetchDocuments();
    }
  }, []);

  const filteredDocuments = availableDocuments.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleSelect = (documentId) => {
    setLocalSelection((prev) => {
      if (prev.includes(documentId)) {
        return prev.filter((id) => id !== documentId);
      } else {
        return [...prev, documentId];
      }
    });
  };

  const handleConfirm = () => {
    // Update the context with all selected documents
    // First clear existing selections, then add new ones
    selectedDocumentIds.forEach((id) => {
      if (!localSelection.includes(id)) {
        selectDocument(id); // This will remove it
      }
    });
    localSelection.forEach((id) => {
      if (!selectedDocumentIds.includes(id)) {
        selectDocument(id); // This will add it
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#f7953f] to-[#E0741C] text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                <FileText size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  Select Document
                  <Sparkles size={20} className="text-white/80" />
                </h2>
                <p className="text-white/90 text-sm mt-1">
                  Choose one or more documents for intelligent conversation
                </p>
              </div>
            </div>
            <IconButton
              onClick={onClose}
              variant="ghost"
              size="md"
              className="text-white hover:bg-white/20"
            >
              <X size={24} />
            </IconButton>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60"
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-10 pr-4 py-3 bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-xl text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all"
            />
          </div>
        </div>

        {/* Document List */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {loading && availableDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingSpinner size="large" />
              <p className="mt-4 text-gray-600 font-medium">Loading documents...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-gradient-to-br from-[#f7953f]/10 to-[#E0741C]/10 rounded-xl mb-4 inline-block">
                <FileText size={64} className="text-[#f7953f]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                {searchQuery ? "No documents found" : "No processed documents"}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery
                  ? "Try a different search term"
                  : "Upload and process documents to get started"}
              </p>
              {!searchQuery && (
                <PrimaryButton
                  onClick={fetchDocuments}
                  variant="outline"
                  size="md"
                  className="mx-auto"
                >
                  <RefreshCw size={18} />
                  <span>Refresh List</span>
                </PrimaryButton>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((doc) => {
                const isSelected = localSelection.includes(doc.id);
                const isCurrentlyActive = selectedDocumentIds.includes(doc.id);

                return (
                  <ChatCard
                    key={doc.id}
                    onClick={() => handleToggleSelect(doc.id)}
                    variant={isSelected ? "primary" : "default"}
                    padding="md"
                    hover={true}
                    className={`group relative cursor-pointer transition-all ${
                      isSelected
                        ? "border-2 border-[#f7953f] shadow-lg"
                        : "border-2 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
                          isSelected
                            ? "bg-gradient-to-br from-[#f7953f] to-[#E0741C]"
                            : "bg-gray-100 group-hover:bg-gray-200"
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
                          className={`font-semibold mb-2 truncate ${
                            isSelected ? "text-[#f7953f]" : "text-gray-900"
                          }`}
                        >
                          {doc.title}
                        </h3>
                        {isCurrentlyActive && (
                          <StatusBadge variant="success" size="sm">
                            <Check size={12} />
                            Currently Active
                          </StatusBadge>
                        )}
                      </div>

                      {/* Selection Checkbox */}
                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center border-2 transition-all ${
                          isSelected
                            ? "bg-[#f7953f] border-[#f7953f]"
                            : "border-gray-300 group-hover:border-gray-400"
                        }`}
                      >
                        {isSelected && <Check size={16} className="text-white" />}
                      </div>
                    </div>
                  </ChatCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 bg-gradient-to-r from-gray-50 to-orange-50/30 border-t">
          <PrimaryButton 
            variant="outline" 
            onClick={onClose} 
            size="md"
          >
            Cancel
          </PrimaryButton>
          <PrimaryButton
            onClick={handleConfirm}
            disabled={localSelection.length === 0}
            variant="primary"
            size="md"
            className="shadow-lg"
          >
            <Check size={18} />
            <span className="font-semibold">
              Confirm {localSelection.length > 0 ? `(${localSelection.length})` : 'Selection'}
            </span>
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
};

export default DocumentSelector;