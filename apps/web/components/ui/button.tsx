'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

const buttonVariants = cva('btn', {
  variants: {
    variant: {
      primary: 'btn-primary',
      ghost: 'btn-ghost',
      buy: 'btn-buy',
      sell: 'btn-sell',
    },
  },
  defaultVariants: {
    variant: 'primary',
  },
});

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => (
    <button ref={ref} className={twMerge(clsx(buttonVariants({ variant }), className))} {...props} />
  ),
);
Button.displayName = 'Button';
