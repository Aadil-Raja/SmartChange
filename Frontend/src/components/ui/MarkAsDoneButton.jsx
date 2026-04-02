import { Check, Loader2, Play } from 'lucide-react';
import { useState } from 'react';
import { useCourses } from '../../hooks/useCourses';

const MarkAsDoneButton = ({ 
  itemId, 
  itemType = 'document', 
  isCompleted = false, 
  progress = 0 
}) => {
  const { markModuleDone } = useCourses();
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
          className="flex w-fit items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-700 transition-all"
        >
          <Check size={16} />
          Video Completed
        </button>
      );
    }

    if (progress > 0 && progress < 100) {
      return (
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={handleMarkAsDone}
            disabled={isMarking}
            className="flex w-fit items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#FDB913] to-[#f7953f] px-5 py-2 text-sm font-semibold text-white transition-all hover:shadow-md hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isMarking ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Marking...
              </>
            ) : (
              <>
                <Check size={16} />
                Mark as Complete
              </>
            )}
          </button>
          <p className="text-xs font-medium text-gray-500">
            Progress: {Math.round(progress)}% • Continue watching or mark as complete
          </p>
        </div>
      );
    }

    return (
      <button
        onClick={handleMarkAsDone}
        disabled={isMarking}
        className="flex w-fit items-center justify-center gap-1.5 rounded-full bg-[#1a1209] px-5 py-2 text-sm font-semibold text-[#faf6ef] transition-all hover:bg-[#2d1f0e] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isMarking ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Starting...
          </>
        ) : (
          <>
            <Play size={15} className="fill-current ml-0.5" />
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
        className="flex w-fit items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-700 transition-all"
      >
        <Check size={16} />
        Completed
      </button>
    );
  }

  return (
    <button
      onClick={handleMarkAsDone}
      disabled={isMarking}
      className="flex w-fit items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#FDB913] to-[#f7953f] px-5 py-2 text-sm font-semibold text-white transition-all hover:shadow-md hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isMarking ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          Marking...
        </>
      ) : (
        <>
          <Check size={16} />
          Mark as Done
        </>
      )}
    </button>
  );
};

export default MarkAsDoneButton;