import { cva, type VariantProps } from 'class-variance-authority';
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn';

const buttonVariants = cva(
  'ds-button disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'ds-button--primary',
        primary: 'ds-button--primary',
        secondary: 'ds-button--secondary',
        success: 'ds-button--success',
        warning: 'ds-button--warning',
        danger: 'ds-button--danger',
        destructive: 'ds-button--danger',
        info: 'ds-button--info',
        outline: 'ds-button--outline',
        ghost: 'ds-button--ghost',
        link: 'ds-button--link'
      },
      size: {
        default: '',
        sm: 'ds-button--sm',
        lg: 'ds-button--lg'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

Button.displayName = 'Button';
