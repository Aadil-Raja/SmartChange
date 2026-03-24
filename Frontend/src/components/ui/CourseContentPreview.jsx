import { FileText, Video, ExternalLink, AlertCircle, Play } from 'lucide-react';

const CourseContentPreview = ({ item }) => {
  const { type, access_url, title, description, thumbnail_url, duration_sec } = item;
  // Use access_url from the new API response
  const url = access_url;

  // Render based on content type
  const renderContent = () => {
    if (!url) {
      return (
        <div className="flex h-64 items-center justify-center rounded-lg bg-gray-100">
          <div className="text-center">
            <AlertCircle size={48} className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">Content not available</p>
          </div>
        </div>
      );
    }

    switch (type) {
      case 'video':
        if (!url) {
          return (
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
              <div className="text-center">
                <Video size={48} className="mx-auto mb-2 text-purple-400" />
                <p className="text-sm text-gray-600">Video not available</p>
              </div>
            </div>
          );
        }
        
        return (
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black relative group">
            {thumbnail_url ? (
              <div className="relative w-full h-full">
                <img
                  src={thumbnail_url}
                  alt={title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => window.open(url, '_blank')}
                    className="bg-white/90 rounded-full p-4 hover:bg-white transition-colors"
                  >
                    <Play size={32} className="text-purple-600 ml-1" />
                  </button>
                </div>
                {duration_sec && (
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {Math.floor(duration_sec / 60)}:{(duration_sec % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
                <button
                  onClick={() => window.open(url, '_blank')}
                  className="flex flex-col items-center gap-3 text-purple-600 hover:text-purple-700 transition-colors"
                >
                  <div className="bg-white/90 rounded-full p-4">
                    <Play size={32} className="ml-1" />
                  </div>
                  <span className="text-sm font-medium">Click to watch video</span>
                </button>
              </div>
            )}
          </div>
        );

      case 'document':
        return (
          <div className="rounded-lg overflow-hidden border border-gray-200 bg-white">
            {thumbnail_url ? (
              <div className="relative group">
                <div className="aspect-video w-full overflow-hidden bg-gray-100">
                  <img
                    src={thumbnail_url}
                    alt={title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-[#f7953f] hover:bg-gray-50 transition-all shadow-lg"
                  >
                    <ExternalLink size={16} />
                    Open Document
                  </a>
                </div>
              </div>
            ) : (
              <div className="aspect-video w-full bg-gradient-to-br from-orange-50 to-yellow-50 flex items-center justify-center">
                <FileText size={64} className="text-[#f7953f]/30" />
              </div>
            )}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
              {description && (
                <p className="text-sm text-gray-600 mb-3">{description}</p>
              )}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#f7953f] hover:text-[#E0741C] transition-colors"
              >
                <ExternalLink size={14} />
                Open Document
              </a>
            </div>
          </div>
        );

      case 'link':
        return (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8">
            <div className="text-center">
              <ExternalLink size={48} className="mx-auto mb-4 text-[#f7953f]" />
              <h4 className="mb-2 font-semibold text-gray-900">{title}</h4>
              {description && (
                <p className="mb-4 text-sm text-gray-600">{description}</p>
              )}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#FDB913] to-[#f7953f] px-4 py-2 font-medium text-white transition-all hover:shadow-lg"
              >
                <ExternalLink size={16} />
                Visit Link
              </a>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex h-64 items-center justify-center rounded-lg bg-gray-100">
            <p className="text-sm text-gray-600">Unknown content type</p>
          </div>
        );
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {renderContent()}
    </div>
  );
};

export default CourseContentPreview;
