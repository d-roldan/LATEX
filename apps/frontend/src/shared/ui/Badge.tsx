import { cva, type VariantProps } from 'class-variance-authority';
import { HTMLAttributes } from 'react';
import { cn } from '../utils/cn';

const badgeVariants = cva(
  'ds-badge',
  {
  variants: {
    variant: {
      default: 'ds-badge--neutral',
      success: 'ds-badge--success',
      warning: 'ds-badge--warning',
      destructive: 'ds-badge--danger',
      danger: 'ds-badge--danger',
      info: 'ds-badge--info',
      primary: 'ds-badge--primary'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
