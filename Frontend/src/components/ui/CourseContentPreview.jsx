import { FileText, Video, ExternalLink, AlertCircle } from 'lucide-react';

const CourseContentPreview = ({ item }) => {
  const { type, url, title, description } = item;

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
        return (
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            <video 
              controls 
              className="h-full w-full"
              src={url}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        );

      case 'document':
        return (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8">
            <div className="text-center">
              <FileText size={48} className="mx-auto mb-4 text-[#F58220]" />
              <h4 className="mb-2 font-semibold text-gray-900">{title}</h4>
              {description && (
                <p className="mb-4 text-sm text-gray-600">{description}</p>
              )}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#FDB913] to-[#F58220] px-4 py-2 font-medium text-white transition-all hover:shadow-lg"
              >
                <ExternalLink size={16} />
                Open Document
              </a>
            </div>
          </div>
        );

      case 'link':
        return (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8">
            <div className="text-center">
              <ExternalLink size={48} className="mx-auto mb-4 text-[#F58220]" />
              <h4 className="mb-2 font-semibold text-gray-900">{title}</h4>
              {description && (
                <p className="mb-4 text-sm text-gray-600">{description}</p>
              )}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#FDB913] to-[#F58220] px-4 py-2 font-medium text-white transition-all hover:shadow-lg"
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
