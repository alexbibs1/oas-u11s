import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, Users, Shield, ClipboardCheck, Calendar, Newspaper, Star } from "lucide-react";
import { getMyRole } from "@/lib/auth/roles.functions";

export function BottomNav() {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyRole(),
    staleTime: 60_000,
  });

  const items = [
    { to: "/home", label: "Home", Icon: Home },
    { to: "/feed", label: "Feed", Icon: Newspaper },
    { to: "/calendar", label: "Calendar", Icon: Calendar },
    { to: "/match-day", label: "Match Day", Icon: ClipboardCheck },
    { to: "/squad", label: "Squad", Icon: Users },
    ...(me?.isBlockBuilder ? [{ to: "/admin", label: "Admin", Icon: Shield }] : []),
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
        {items.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
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
  );
}
