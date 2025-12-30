import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { CollabEditor } from "@/components/editor/CollabEditor";
import { Facepile } from "@/components/docs/Facepile";
import { authClient } from "@/lib/auth-client";
import { Globe, Lock, Trash2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/(docs)/docs/$docId")({
  beforeLoad: async ({ context, params }) => {
    const docId = params.docId as Id<"documents">;
    // Fetch doc metadata only - content loads client-side for performance
    const doc = await context.queryClient.ensureQueryData(convexQuery(api.docs.get, { docId }));
    return { doc, docId };
  },
  component: DocRoute,
});

function DocRoute() {
  const navigate = useNavigate();
  const routeContext = Route.useRouteContext();
  const docId = routeContext.docId as Id<"documents">;
  // SSR data from beforeLoad - guaranteed available
  const ssrDoc = routeContext.doc;

  const { data: session } = authClient.useSession();

  // Live updates via React Query + Convex
  const { data: liveDoc } = useQuery(convexQuery(api.docs.get, { docId }));
  const doc = liveDoc ?? ssrDoc;
  
  // Mutations via React Query + Convex
  const { mutateAsync: updateTitle } = useMutation({
    mutationFn: useConvexMutation(api.docs.updateTitle),
  });
  const { mutateAsync: setVisibility } = useMutation({
    mutationFn: useConvexMutation(api.docs.setVisibility),
  });
  const { mutateAsync: removeDoc } = useMutation({
    mutationFn: useConvexMutation(api.docs.remove),
  });

  // Presence via React Query + Convex
  const { mutateAsync: heartbeat } = useMutation({
    mutationFn: useConvexMutation(api.presence.heartbeat),
  });
  const { mutateAsync: leavePresence } = useMutation({
    mutationFn: useConvexMutation(api.presence.leave),
  });
  const { data: presenceList = [] } = useQuery(convexQuery(api.presence.list, { docId }));

  // Local title state - initialize from SSR data (guaranteed available)
  const [localTitle, setLocalTitle] = useState(ssrDoc?.title ?? "");
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync local title with doc title when doc changes
  useEffect(() => {
    if (doc && doc.title !== undefined) {
      setLocalTitle(doc.title);
    }
  }, [doc?._id, doc?.title]);

  // Heartbeat for presence (only if authenticated)
  useEffect(() => {
    if (!session) return;

    const run = async () => {
      try {
        await heartbeat({ docId });
      } catch (e) {
        // Ignore errors
      }
    };

    // Initial heartbeat
    run();

    // Heartbeat interval
    const interval = setInterval(run, 10_000);

    // Cleanup: leave presence on unmount
    return () => {
      clearInterval(interval);
      leavePresence({ docId }).catch(() => {});
    };
  }, [docId, session, heartbeat, leavePresence]);

  // Filter to active presence
  const activePresence = useMemo(() => {
    const now = Date.now();
    return presenceList.filter((p) => now - p.updatedAt < 30_000);
  }, [presenceList]);

  // Handle title save
  const handleTitleBlur = async () => {
    if (!doc?.isOwner) return;
    const trimmed = localTitle.trim() || "Untitled";
    if (trimmed !== doc.title) {
      await updateTitle({ docId, title: trimmed });
    }
  };

  // Handle visibility toggle
  const handleToggleVisibility = async () => {
    if (!doc?.isOwner) return;
    await setVisibility({
      docId,
      visibility: doc.visibility === "public" ? "private" : "public",
    });
  };

  // Handle delete
  const handleDelete = async () => {
    if (!doc?.isOwner || isDeleting) return;
    if (!confirm("Are you sure you want to delete this document?")) return;

    setIsDeleting(true);
    try {
      await removeDoc({ docId });
      navigate({ to: "/docs" });
    } catch (e) {
      setIsDeleting(false);
    }
  };

  // Not found / no access (useSuspenseQuery guarantees data is loaded, never undefined)
  if (doc === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <h2 className="text-xl font-medium mb-2">Document not found</h2>
        <p className="text-muted-foreground mb-4">
          This document may have been deleted or you don't have access.
        </p>
        <Button variant="outline" onClick={() => navigate({ to: "/docs" })}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to documents
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Title */}
            <input
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              readOnly={!doc.isOwner}
              className="flex-1 bg-transparent text-xl font-semibold outline-none placeholder:text-muted-foreground"
              placeholder="Untitled"
            />

            {/* Visibility toggle */}
            <Button
              variant="ghost"
              size="sm"
              disabled={!doc.isOwner}
              onClick={handleToggleVisibility}
              className="gap-2 text-muted-foreground hover:text-foreground"
              title={doc.visibility === "public" ? "Public - anyone can view" : "Private - only you and editors"}
            >
              {doc.visibility === "public" ? (
                <Globe className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              <span className="text-xs capitalize">{doc.visibility}</span>
            </Button>

            {/* Delete button (owner only) */}
            {doc.isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-muted-foreground hover:text-destructive"
                title="Delete document"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}

            {/* Facepile */}
            <Facepile users={activePresence} />
          </div>

          {/* Edit indicator */}
          {!doc.canEdit && (
            <p className="text-xs text-muted-foreground mt-2">
              You can view this document but cannot edit it.
              {!session && " Sign in to see if you have edit access."}
            </p>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <CollabEditor docId={docId} editable={doc.canEdit} />
      </div>
    </div>
  );
}

