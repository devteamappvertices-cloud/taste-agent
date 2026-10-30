/** A chat bubble (the agent) with a mouth sticking its tongue out (taste). Mirrors src/app/icon.svg. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--forest)" />
      <rect x="6.5" y="7.5" width="19" height="14" rx="5" fill="var(--forest-ink)" />
      <polygon points="9.5,20 9.5,25.5 14.5,21.4" fill="var(--forest-ink)" />
      <path d="M10.6 11.4 Q16 16.2 21.4 11.4" fill="none" stroke="var(--forest)" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M13.2 13.3 H18.8 V16 A2.8 2.8 0 0 1 13.2 16 Z" fill="#EF6F7E" />
      <line x1="16" y1="14.2" x2="16" y2="16.8" stroke="#C94A5E" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}
