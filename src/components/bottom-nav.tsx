import { Link } from "@tanstack/react-router";
import { Home, Users, Shield, ClipboardCheck, Calendar, Newspaper, Star, Eye, EyeOff } from "lucide-react";
import { useMyRole, setViewAsCoach } from "@/lib/auth/view-as";

export function BottomNav() {
  const { data: me, realIsBlockBuilder, viewAsCoach } = useMyRole();

  const items = [
    { to: "/home", label: "Home", Icon: Home },
    { to: "/feed", label: "Feed", Icon: Newspaper },
    { to: "/calendar", label: "Calendar", Icon: Calendar },
    { to: "/match-day", label: "Match Day", Icon: ClipboardCheck },
    { to: "/ratings", label: "Ratings", Icon: Star },
    { to: "/squad", label: "Squad", Icon: Users },
    ...(me?.isBlockBuilder ? [{ to: "/admin", label: "Admin", Icon: Shield }] : []),
  ] as const;

  return (
    <>
      {realIsBlockBuilder && (
        <button
          type="button"
          onClick={() => setViewAsCoach(!viewAsCoach)}
          className={`fixed bottom-24 right-3 z-40 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-md transition-colors ${
            viewAsCoach
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border bg-card text-muted-foreground hover:text-primary"
          }`}
          title={viewAsCoach ? "Currently viewing as coach — tap to return to admin view" : "Preview the app as a coach"}
        >
          {viewAsCoach ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {viewAsCoach ? "Viewing as coach" : "View as coach"}
        </button>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
          {items.map(({ to, label, Icon }) => (
            <li key={to} className="flex-1">
              <Link
                to={to}
                replace
                activeProps={{ className: "text-primary" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                className="flex flex-col items-center gap-1 px-2 py-3 text-[11px] font-medium transition-colors hover:text-primary"
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
