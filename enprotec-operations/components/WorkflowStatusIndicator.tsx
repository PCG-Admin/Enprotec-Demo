import React from 'react';
import { WorkflowStatus } from '../types';

interface WorkflowStatusIndicatorProps {
  steps: WorkflowStatus[];
  currentStep: WorkflowStatus;
}

const formatStatusLabel = (status: WorkflowStatus): string => {
  switch (status) {
    case WorkflowStatus.COMPLETED:
      return 'Completed - Accepted';
    case WorkflowStatus.REJECTED_AT_DELIVERY:
      return 'Completed - Rejected';
    default:
      return status;
  }
};

const WorkflowStatusIndicator: React.FC<WorkflowStatusIndicatorProps> = ({ steps, currentStep }) => {
  const shouldAppendRejected =
    currentStep === WorkflowStatus.REJECTED_AT_DELIVERY &&
    !steps.includes(WorkflowStatus.REJECTED_AT_DELIVERY);

  const effectiveSteps = shouldAppendRejected
    ? [...steps, WorkflowStatus.REJECTED_AT_DELIVERY]
    : steps;

  const normalizedSteps = effectiveSteps.map(step => step.toLowerCase());
  const normalizedCurrent = currentStep.toLowerCase();

  let currentIndex = normalizedSteps.indexOf(normalizedCurrent);
  let forcedToLast = false;
  const normalizedEpod = WorkflowStatus.EPOD_CONFIRMED.toLowerCase();
  const normalizedRejected = WorkflowStatus.REJECTED_AT_DELIVERY.toLowerCase();

  if (normalizedCurrent === normalizedEpod && effectiveSteps.length > 0) {
    if (currentIndex !== normalizedSteps.length - 1) {
      currentIndex = normalizedSteps.length - 1;
      forcedToLast = true;
    }
  }

  if (normalizedCurrent === normalizedRejected && normalizedSteps.length > 0) {
    if (currentIndex !== normalizedSteps.length - 1) {
      currentIndex = normalizedSteps.length - 1;
      forcedToLast = true;
    }
  }

  if (currentIndex === -1) {
    currentIndex = 0;
  }

  const forcedLabel =
    normalizedCurrent === normalizedEpod
      ? WorkflowStatus.EPOD_CONFIRMED
      : normalizedCurrent === normalizedRejected
        ? WorkflowStatus.REJECTED_AT_DELIVERY
        : currentStep;

  return (
    <div className="w-full pt-4">
      <div className="flex items-center" aria-label="Workflow progress">
        {effectiveSteps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;

          let circleClasses = 'w-2.5 h-2.5 rounded-full transition-colors duration-300';
          let lineClasses = 'flex-1 h-0.5 transition-colors duration-300';
          let textColor = 'text-zinc-400';

          if (isCompleted) {
            circleClasses += ' bg-sky-500';
            lineClasses += ' bg-sky-500';
            textColor = 'text-sky-600 font-semibold';
          } else if (isCurrent) {
            circleClasses += ' bg-sky-500 ring-4 ring-sky-500/20';
            lineClasses += ' bg-zinc-200';
            textColor = 'text-sky-600 font-bold';
          } else { // isFuture
            circleClasses += ' bg-zinc-200';
            lineClasses += ' bg-zinc-200';
          }

          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center relative">
                <div className={circleClasses} />
                {isCurrent && (
                  <span className={`absolute top-5 text-xs text-center ${textColor}`}>
                    {forcedToLast
                      ? formatStatusLabel(forcedLabel)
                      : normalizedSteps[index] === normalizedCurrent
                        ? formatStatusLabel(step)
                        : formatStatusLabel(currentStep)}
                  </span>
                )}
              </div>
              {index < effectiveSteps.length - 1 && <div className={lineClasses} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowStatusIndicator;
