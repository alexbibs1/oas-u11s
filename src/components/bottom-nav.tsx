import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, Users, Shield, ClipboardCheck } from "lucide-react";
import { getMyRole } from "@/lib/auth/roles.functions";

export function BottomNav() {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyRole(),
    staleTime: 60_000,
  });

  const items = [
    { to: "/home", label: "Home", Icon: Home },
    { to: "/squad", label: "Squad", Icon: Users },
    { to: "/match-day", label: "Match Day", Icon: ClipboardCheck },
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
              className="flex flex-col items-center gap-1 px-4 py-3 text-xs font-medium transition-colors hover:text-primary"
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
