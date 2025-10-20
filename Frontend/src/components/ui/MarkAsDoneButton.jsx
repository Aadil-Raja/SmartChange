import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useCourses } from '../../hooks/useCourses';

const MarkAsDoneButton = ({ itemId, itemType = 'document' }) => {  // ADD itemType prop
  const { markModuleDone, completedItems } = useCourses();
  const [isMarking, setIsMarking] = useState(false);
  const isCompleted = completedItems.has(itemId);

  const handleMarkAsDone = async () => {
    if (isCompleted) return;
    
    setIsMarking(true);
    const result = await markModuleDone(itemId, itemType);  // PASS itemType
    setIsMarking(false);

    if (!result.success) {
      alert(result.message || 'Failed to mark as complete');
    }
  };

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
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#FDB913] to-[#F58220] px-4 py-2.5 font-medium text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
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