import type { ReactNode } from 'react';

interface BadgeProps {
  variant?: 'default' | 'warning' | 'success';
  children: ReactNode;
}

const VARIANT_CLASSES: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-bg-muted text-text-base',
  warning: 'bg-primary text-white',
  success: 'bg-secondary text-white',
};

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-caption font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
