import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, subtitle, action, children, className = "" }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, sub, tone = "neutral", icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "neutral" | "up" | "down" | "ai"; icon?: ReactNode }) {
  const toneCls = tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : tone === "ai" ? "text-ai" : "text-foreground";
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
      </div>
      <div className={`num mt-2 text-2xl font-semibold ${toneCls}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function SimTag({ children = "Simulated" }: { children?: ReactNode }) {
  return <span className="inline-flex items-center rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">{children}</span>;
}

export function Delta({ value, suffix = "%", digits = 2 }: { value: number; suffix?: string; digits?: number }) {
  return (
    <span className={`num ${value >= 0 ? "text-success" : "text-destructive"}`}>
      {value >= 0 ? "▲" : "▼"} {Math.abs(value).toFixed(digits)}
      {suffix}
    </span>
  );
}
