import { Link } from "@tanstack/react-router";
import { Snowflake } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/", label: "Home" },
  { to: "/upload", label: "Upload" },
  { to: "/feedback", label: "Feedback" },
  { to: "/compare", label: "Compare" },
  { to: "/statistics", label: "Statistics" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/nutrition", label: "Nutrition" },
] as const;

export function AppNav() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
          <Snowflake className="size-5 text-ice" />
          <span className="text-gradient-ice">Hockey Video Analyzer</span>
        </Link>
        <ul className="flex flex-wrap items-center gap-1 text-sm">
          {links.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                activeOptions={{ exact: l.to === "/" }}
                activeProps={{ className: "bg-secondary text-foreground" }}
                inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                className="rounded-md px-3 py-1.5 transition-colors"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {email ? (
            <>
              <span className="hidden text-muted-foreground sm:inline">{email}</span>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/";
                }}
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              search={{ next: undefined }}
              className="rounded-md bg-secondary px-3 py-1.5 text-foreground transition-colors hover:bg-secondary/80"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

export function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="mx-auto max-w-7xl px-5 py-10">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-muted-foreground">{subtitle}</p> : null}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}