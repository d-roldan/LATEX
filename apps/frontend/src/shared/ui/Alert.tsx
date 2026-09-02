import { HTMLAttributes } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '../utils/cn';

type AlertVariant = 'success' | 'warning' | 'danger' | 'info';

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

const icons = { success: CheckCircle2, warning: AlertTriangle, danger: AlertCircle, info: Info };

export function Alert({ variant = 'info', className, children, ...props }: AlertProps) {
  const Icon = icons[variant];
  return (
    <div className={cn('ds-alert', `ds-alert--${variant}`, className)} role="alert" {...props}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
