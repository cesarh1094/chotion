import { createRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexProvider } from "convex/react";

import * as Sentry from "@sentry/tanstackstart-react";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import { QueryClient } from "@tanstack/react-query";
import { env } from "./env";

// Create a new router instance
export const getRouter = () => {
  const convexQueryClient = new ConvexQueryClient(env.VITE_CONVEX_URL);

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });

  convexQueryClient.connect(queryClient);

  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      scrollRestoration: true,
      defaultPreloadStaleTime: 0,
      context: { queryClient },
      Wrap: ({ children }) => (
        <ConvexProvider client={convexQueryClient.convexClient}>
          {children}
        </ConvexProvider>
      ),
    }),
    queryClient,
  );

  if (!router.isServer) {
    Sentry.init({
      dsn: env.VITE_SENTRY_DSN,
      integrations: [],
      tracesSampleRate: 1.0,
      sendDefaultPii: true,
    });
  }

  return router;
};
