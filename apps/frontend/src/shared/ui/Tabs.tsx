import { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ds-tabs', className)} role="tablist" {...props} />;
}

interface TabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function Tab({ active = false, className, ...props }: TabProps) {
  return <button className={cn('ds-tab', className)} role="tab" aria-selected={active} {...props} />;
}
