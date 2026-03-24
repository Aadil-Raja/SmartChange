import { Check, Loader2, Play } from 'lucide-react';
import { useState } from 'react';
import { useCourses } from '../../hooks/useCourses';

const MarkAsDoneButton = ({ 
  itemId, 
  itemType = 'document', 
  isCompleted = false, 
  progress = 0 
}) => {
  const { markModuleDone, updateVideoProgress } = useCourses();
  const [isMarking, setIsMarking] = useState(false);

  const handleMarkAsDone = async () => {
    if (isCompleted) return;
    
    setIsMarking(true);
    const result = await markModuleDone(itemId, itemType);
    setIsMarking(false);

    if (!result.success) {
      alert(result.message || 'Failed to mark as complete');
    }
  };

  // For videos, show different states based on progress
  if (itemType === 'video') {
    if (isCompleted) {
      return (
        <button
          disabled
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-green-500 bg-green-50 px-4 py-2.5 font-medium text-green-700"
        >
          <Check size={20} />
          Video Completed
        </button>
      );
    }

    if (progress > 0 && progress < 100) {
      return (
        <div className="space-y-2">
          <button
            onClick={handleMarkAsDone}
            disabled={isMarking}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#FDB913] to-[#f7953f] px-4 py-2.5 font-medium text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isMarking ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Marking...
              </>
            ) : (
              <>
                <Check size={20} />
                Mark as Complete
              </>
            )}
          </button>
          <p className="text-xs text-gray-500 text-center">
            Video progress: {Math.round(progress)}% • Continue watching or mark as complete
          </p>
        </div>
      );
    }

    return (
      <button
        onClick={handleMarkAsDone}
        disabled={isMarking}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 font-medium text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isMarking ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Starting...
          </>
        ) : (
          <>
            <Play size={20} />
            Start Video
          </>
        )}
      </button>
    );
  }

  // For documents and links
  if (isCompleted) {
    return (
      <button
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-green-500 bg-green-50 px-4 py-2.5 font-medium text-green-700"
      >
        <Check size={20} />
        Completed
      </button>
    );
  }

  return (
    <button
      onClick={handleMarkAsDone}
      disabled={isMarking}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#FDB913] to-[#f7953f] px-4 py-2.5 font-medium text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isMarking ? (
        <>
          <Loader2 size={20} className="animate-spin" />
          Marking...
        </>
      ) : (
        <>
          <Check size={20} />
          Mark as Done
        </>
      )}
    </button>
  );
};

export default MarkAsDoneButton;