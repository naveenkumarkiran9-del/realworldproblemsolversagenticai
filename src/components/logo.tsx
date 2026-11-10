export function Logo({ size = 34 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-xl bg-gradient-ai shadow-glow"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none">
        <path d="M3 17l5-5 4 3 7-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-ai-foreground" />
        <path d="M15 7h4v4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-ai-foreground" />
      </svg>
    </div>
  );
}
