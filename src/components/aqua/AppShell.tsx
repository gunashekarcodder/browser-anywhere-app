import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Cctv,
  Database,
  FlaskConical,
  LayoutDashboard,
  Map,
  Menu,
  LogIn,
  LogOut,
  Radar,
  Trash2,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/monitor", label: "Live monitor", icon: Radar },
  { to: "/incidents", label: "Incidents", icon: AlertTriangle },
  { to: "/map", label: "Zone map", icon: Map },
  { to: "/cameras", label: "Cameras", icon: Cctv },
  { to: "/datasets", label: "Datasets", icon: Database },
  { to: "/evaluation", label: "Evaluation", icon: FlaskConical },
  { to: "/recycle-bin", label: "Recycling bin", icon: Trash2 },
] as const;

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, user, signOut } = useAuth();

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] border-r border-border bg-sidebar px-4 py-5 transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
              <Activity className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-base font-semibold">AquaSentinel AI</span>
              <span className="block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Waterlogging intelligence
              </span>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="mt-6 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              activeProps={{
                className:
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm bg-sidebar-accent text-foreground font-medium",
              }}
              activeOptions={{ exact: to === "/" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Smart Coders</p>
          <p className="mt-1">ELCIA Smart City Drone-AI Challenge 2026 — Track 2</p>
          <p className="mt-2">
            Vision stage: rule-based water estimator + AI frame verification. Severity is an
            explainable weighted engine, not a trained model.
          </p>
        </div>
      </aside>

      {open && (
        <button
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden"
          aria-label="Dismiss navigation"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-lg font-semibold md:text-xl">{title}</h1>
              {subtitle && (
                <p className="truncate text-xs text-muted-foreground md:text-sm">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:block">
                  {user?.email}
                </span>
                <Button variant="outline" size="sm" onClick={() => void signOut()}>
                  <LogOut className="mr-1.5 h-4 w-4" /> Sign out
                </Button>
              </div>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to="/auth">
                  <LogIn className="mr-1.5 h-4 w-4" /> Operator sign-in
                </Link>
              </Button>
            )}
          </div>
        </header>
        <main className="px-4 py-5 md:px-6 md:py-7">{children}</main>
      </div>
    </div>
  );
}
