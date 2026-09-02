import { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export function Dropdown({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ds-dropdown', className)} role="menu" {...props} />;
}

export function DropdownItem({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('ds-dropdown__item', className)} role="menuitem" {...props} />;
}
