import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest } from "@tanstack/react-start/server";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import {
  fetchSession,
  getCookieName,
} from "@convex-dev/better-auth/react-start";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { ConvexReactClient } from "convex/react";
import { authClient } from "../lib/auth-client";
import type { QueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";

import Header from "../components/Header";

import appCss from "../styles.css?url";

// Get auth information for SSR using available cookies
const fetchAuth = createServerFn({ method: "GET" }).handler(async () => {
  const { createAuth } = await import("../../convex/auth");
  const { session } = await fetchSession(getRequest());
  const sessionCookieName = getCookieName(createAuth);
  const token = getCookie(sessionCookieName);
  return {
    userId: session?.user.id,
    token,
  };
});

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  beforeLoad: async (ctx) => {
    // all queries, mutations and action made with TanStack Query will be
    // authenticated by an identity token.
    const { userId, token } = await fetchAuth();

    // During SSR only (the only time serverHttpClient exists),
    // set the auth token to make HTTP queries with.
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }

    return { userId, token };
  },
  component: RootComponent,
});

function RootComponent() {
  const context = useRouteContext({ from: Route.id });

  return (
    <RootDocument>
      <ConvexBetterAuthProvider
        client={context.convexClient}
        authClient={authClient}
      >
        <ThemeProvider defaultTheme="system" storageKey="chotion-theme">
          <Header />
          <Outlet />
        </ThemeProvider>
      </ConvexBetterAuthProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            { name: "Tanstack Query", render: <ReactQueryDevtoolsPanel /> },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
