import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { Globe, Lock, Plus, Search, LogIn } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/(docs)/docs")({
  loader: async ({ context }) => {
    // Prefetch docs into React Query cache before component mounts
    await context.queryClient.prefetchQuery(convexQuery(api.docs.list, {}));
  },
  component: DocsLayout,
});

function DocsLayout() {
  const navigate = useNavigate();
  const { data: session, isPending: isSessionPending } = authClient.useSession();

  const [searchQuery, setSearchQuery] = useState("");
  const query = searchQuery.trim() || undefined;

  // Data is prefetched in loader, placeholderData keeps it while subscription connects
  const { data: docs = [], isLoading } = useQuery({
    ...convexQuery(api.docs.list, { query }),
    placeholderData: (prev) => prev, // Preserve previous data during subscription reconnect
  });

  // Mutation via React Query + Convex
  const { mutateAsync: createDoc } = useMutation({
    mutationFn: useConvexMutation(api.docs.create),
  });

  const handleNew = async () => {
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    const id = await createDoc({ title: "Untitled", visibility: "private" });
    navigate({ to: "/docs/$docId", params: { docId: id } });
  };

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-muted/30 flex flex-col">
        {/* Sidebar header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <Link to="/" className="font-semibold text-lg tracking-tight text-foreground">
              Chotion
            </Link>
            {session ? (
              <Button size="sm" variant="secondary" onClick={handleNew} className="h-8">
                <Plus className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" variant="secondary" asChild className="h-8">
                <Link to="/login">
                  <LogIn className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="pl-8 h-9 bg-background"
            />
          </div>
        </div>

        {/* Documents list */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Show skeleton while loading */}
          {isLoading ? (
            <div className="space-y-1">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="text-sm text-muted-foreground p-3 text-center">
              {searchQuery ? "No documents found" : "No documents yet"}
            </div>
          ) : (
            <div className="space-y-0.5">
              {docs.map((doc) => (
                <Link
                  key={doc._id}
                  to="/docs/$docId"
                  params={{ docId: doc._id }}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground/80 hover:bg-accent hover:text-accent-foreground transition-colors"
                  activeProps={{
                    className:
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-accent text-accent-foreground",
                  }}
                >
                  {doc.visibility === "public" ? (
                    <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="truncate">{doc.title || "Untitled"}</span>
                  {doc.isOwner && (
                    <span className="ml-auto text-[10px] text-muted-foreground">owner</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* User status */}
        {!isSessionPending && (
          <div className="p-3 border-t border-border text-xs text-muted-foreground">
            {session ? (
              <span>Signed in as {session.user?.name || session.user?.email}</span>
            ) : (
              <span>Viewing public documents</span>
            )}
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

