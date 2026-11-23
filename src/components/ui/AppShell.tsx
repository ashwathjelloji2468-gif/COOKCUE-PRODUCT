import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, Building2, Activity } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div
      className="min-h-screen text-[var(--foreground)] transition-colors"
      style={{ background: "var(--background)" }}
    >
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md transition-colors"
        style={{
          background: "var(--header-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-semibold text-[var(--foreground)]"
          >
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center p-1 shadow-xs">
              <Image
                src="/cookcue-logo.png"
                alt="CookCue Logo"
                width={28}
                height={28}
                className="h-6 w-auto object-contain"
                priority
              />
            </div>
            <span className="text-lg tracking-tight font-bold font-heading">CookCue</span>
          </Link>

          <div className="flex items-center gap-2 md:gap-3">
            <nav className="hidden md:flex items-center gap-1">
              <NavLink href="/founder" icon={<LayoutDashboard className="w-4 h-4" />}>
                Dashboard
              </NavLink>
              <NavLink href="/founder/contractors" icon={<Building2 className="w-4 h-4" />}>
                Contractors
              </NavLink>
              <NavLink href="/founder/monitoring" icon={<Activity className="w-4 h-4" />}>
                Monitoring
              </NavLink>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {(title || subtitle) && (
          <div className="mb-10">
            {title && (
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--foreground)]">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-2 text-[var(--muted)] text-lg">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

function NavLink({
  href,
  children,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors"
    >
      {icon}
      {children}
    </Link>
  );
}
