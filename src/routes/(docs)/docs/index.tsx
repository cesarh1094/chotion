import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { FileText, Plus } from "lucide-react";

export const Route = createFileRoute("/(docs)/docs/")({
  component: DocsIndex,
});

function DocsIndex() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const createDoc = useMutation(api.docs.create);

  const handleNew = async () => {
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    const id = await createDoc({ title: "Untitled", visibility: "private" });
    navigate({ to: "/docs/$docId", params: { docId: id } });
  };

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <FileText className="h-16 w-16 text-muted-foreground/50 mb-6" />
      <h2 className="text-xl font-medium text-foreground mb-2">
        Select a document
      </h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        Choose a document from the sidebar, or create a new one to get started.
      </p>
      {session && (
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Create new document
        </Button>
      )}
    </div>
  );
}



