interface CounterProps {
  current: number;
  max: number;
}

export function Counter({ current, max }: CounterProps) {
  return (
    <p className="text-body" aria-live="polite">
      選択中: {current}/{max}
    </p>
  );
}
