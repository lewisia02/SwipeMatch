interface ToastProps {
  message: string;
  variant?: 'success' | 'error' | 'info';
}

const VARIANT_CLASSES: Record<NonNullable<ToastProps['variant']>, string> = {
  success: 'bg-secondary text-white',
  error: 'bg-danger text-white',
  info: 'bg-gray-800 text-white',
};

export function Toast({ message, variant = 'info' }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md px-4 py-2 shadow-lg ${VARIANT_CLASSES[variant]}`}
    >
      {message}
    </div>
  );
}
