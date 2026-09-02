import { HTMLAttributes } from 'react';
import { cn } from '../utils/cn';

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  label?: string;
}

export function Progress({ value, label, className, ...props }: ProgressProps) {
  const normalized = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('ds-progress', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={normalized} aria-label={label} {...props}>
      <div className="ds-progress__bar" style={{ width: `${normalized}%` }} />
    </div>
  );
}
