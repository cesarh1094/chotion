import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Italic, Strikethrough, Code } from "lucide-react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const REMOTE_ORIGIN = "remote";

interface CollabEditorProps {
  docId: Id<"documents">;
  editable: boolean;
}

export function CollabEditor({ docId, editable }: CollabEditorProps) {
  // Create a stable Yjs doc per docId
  const ydocRef = useRef<Y.Doc | null>(null);
  const prevDocIdRef = useRef<string | null>(null);

  // Reset ydoc when docId changes
  if (prevDocIdRef.current !== docId) {
    ydocRef.current = new Y.Doc();
    prevDocIdRef.current = docId;
  }

  const ydoc = ydocRef.current!;

  const { mutateAsync: submitUpdate } = useMutation({
    mutationFn: useConvexMutation(api.collab.submitUpdate),
  });
  const [afterSeq, setAfterSeq] = useState(0);

  // Reset afterSeq when docId changes
  useEffect(() => {
    setAfterSeq(0);
  }, [docId]);

  // Subscribe to updates from Convex via React Query
  const { data: updates = [] } = useQuery(
    convexQuery(api.collab.listUpdates, { docId, afterSeq, limit: 128 })
  );

  // Apply remote updates to Yjs doc
  useEffect(() => {
    let maxSeq = afterSeq;

    for (const update of updates) {
      maxSeq = Math.max(maxSeq, update.seq);

      // Skip our own updates
      if (update.clientId === ydoc.clientID) continue;

      try {
        // Convert ArrayBuffer from Convex to Uint8Array for Yjs
        const updateData =
          update.update instanceof ArrayBuffer
            ? new Uint8Array(update.update)
            : new Uint8Array(update.update);
        Y.applyUpdate(ydoc, updateData, REMOTE_ORIGIN);
      } catch (e) {
        console.error("Failed to apply update:", e);
      }
    }

    if (maxSeq > afterSeq) {
      setAfterSeq(maxSeq);
    }
  }, [updates, afterSeq, ydoc]);

  // Submit local updates to Convex (only if editable)
  useEffect(() => {
    if (!editable) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: Uint8Array[] = [];
    let isFlushing = false;

    const flush = async () => {
      if (pending.length === 0 || isFlushing) return;

      isFlushing = true;
      const toSend =
        pending.length === 1 ? pending[0] : Y.mergeUpdates(pending);
      pending = [];

      try {
        // Convert Uint8Array to ArrayBuffer for Convex v.bytes()
        const arrayBuffer = toSend.buffer.slice(
          toSend.byteOffset,
          toSend.byteOffset + toSend.byteLength,
        ) as ArrayBuffer;
        await submitUpdate({
          docId,
          update: arrayBuffer,
          clientId: ydoc.clientID,
        });
      } catch (e) {
        console.error("Failed to submit update:", e);
      } finally {
        isFlushing = false;
      }
    };

    const onUpdate = (update: Uint8Array, origin: unknown) => {
      // Ignore updates from remote
      if (origin === REMOTE_ORIGIN) return;

      pending.push(update);

      // Debounce flush
      if (timer) return;
      timer = setTimeout(async () => {
        timer = null;
        await flush();
      }, 50);
    };

    ydoc.on("update", onUpdate);

    return () => {
      ydoc.off("update", onUpdate);
      if (timer) clearTimeout(timer);
      // Best-effort final flush
      if (pending.length > 0) {
        void flush();
      }
    };
  }, [docId, editable, submitUpdate, ydoc]);

  // Create the TipTap editor
  const editor = useEditor(
    {
      extensions: [
        // Disable undoRedo since Yjs handles history
        StarterKit.configure({
          undoRedo: false,
        }),
        Collaboration.configure({
          document: ydoc,
        }),
      ],
      editable,
      editorProps: {
        attributes: {
          class:
            "min-h-[60vh] outline-none prose prose-neutral dark:prose-invert max-w-none focus:outline-none",
        },
      },
      immediatelyRender: false,
    },
    [docId, editable],
  );

  // Update editor editable state if it changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  if (!editor) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="relative">
      {!editable && (
        <div className="absolute top-0 right-0 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          View only
        </div>
      )}

      {editor && editable && (
        <BubbleMenu
          editor={editor}
          className="flex items-center gap-1 bg-background border border-border rounded-lg shadow-lg p-1"
        >
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-muted ${editor.isActive("bold") ? "bg-muted text-foreground" : "text-muted-foreground"}`}
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-muted ${editor.isActive("italic") ? "bg-muted text-foreground" : "text-muted-foreground"}`}
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-2 rounded hover:bg-muted ${editor.isActive("strike") ? "bg-muted text-foreground" : "text-muted-foreground"}`}
          >
            <Strikethrough className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-2 rounded hover:bg-muted ${editor.isActive("code") ? "bg-muted text-foreground" : "text-muted-foreground"}`}
          >
            <Code className="h-4 w-4" />
          </button>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
