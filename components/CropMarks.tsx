export function CropMarks() {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute -left-2 -top-2 h-4 w-4 border-l-2 border-t-2 border-ink"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-2 -top-2 h-4 w-4 border-r-2 border-t-2 border-ink"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-2 -left-2 h-4 w-4 border-b-2 border-l-2 border-ink"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-2 -right-2 h-4 w-4 border-b-2 border-r-2 border-ink"
      />
    </>
  );
}
