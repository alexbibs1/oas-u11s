import { createFileRoute, redirect } from "@tanstack/react-router";

// Public landing redirects: signed-in users go to /home, signed-out to /auth.
// The actual home page lives at /home under _authenticated.
export const Route = createFileRoute("/")({
  component: () => null,
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});
