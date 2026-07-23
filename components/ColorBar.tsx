interface ColorBarProps {
  className?: string;
}

export function ColorBar({ className = '' }: ColorBarProps) {
  return (
    <div aria-hidden className={`flex overflow-hidden ${className}`}>
      <span className="flex-1 bg-ink" />
      <span className="flex-1 bg-secondary" />
      <span className="flex-1 bg-primary" />
      <span className="flex-1 bg-proof-yellow" />
    </div>
  );
}
