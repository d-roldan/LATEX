import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        'ds-input px-3 py-2',
        (props.type === 'number' || props.type === 'date' || props.type === 'time' || props.type === 'datetime-local') &&
          'font-mono tabular-nums',
        className
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'ds-input min-h-[88px] px-3 py-2',
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn('ds-input px-3 py-2', className)} {...props} />
  )
);

Select.displayName = 'Select';
