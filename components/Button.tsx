import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary text-white',
  secondary: 'bg-secondary text-white',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading = false, disabled, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`rounded-md px-4 py-3 font-semibold outline-none transition-transform disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ink focus-visible:ring-offset-[3px] focus-visible:ring-offset-paper active:scale-[0.98] ${VARIANT_CLASSES[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? '送信中...' : children}
    </button>
  );
});
