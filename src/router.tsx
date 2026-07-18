import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // 30s: preloaded data is considered stale after 30s, so rapid back/forward
    // navigation reuses cached data instead of refetching every server fn on
    // every nav. Bump higher for less churn, lower for fresher data.
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
