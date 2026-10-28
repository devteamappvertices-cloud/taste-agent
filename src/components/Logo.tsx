/** Two taste circles overlapping; the marigold overlap is "your match". */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--forest)" />
      <path d="M16 9.94A7 7 0 0 1 16 22.06A7 7 0 0 1 16 9.94Z" fill="var(--marigold)" />
      <circle cx="12.5" cy="16" r="7" fill="none" stroke="var(--forest-ink)" strokeWidth="2.25" />
      <circle cx="19.5" cy="16" r="7" fill="none" stroke="var(--forest-ink)" strokeWidth="2.25" />
    </svg>
  );
}
