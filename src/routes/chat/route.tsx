import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, MessageSquare, Trash2, Pencil } from "lucide-react";
import { createThread, listThreads, deleteThread, renameThread } from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";

const threadsQueryOptions = queryOptions({
  queryKey: ["threads"],
  queryFn: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { threads: [] as { id: string; title: string; created_at: string; updated_at: string }[] };
    return listThreads();
  },
  staleTime: 30_000,
});

export const Route = createFileRoute("/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  const { data } = useSuspenseQuery(threadsQueryOptions);
  const threads = data.threads ?? [];
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  const handleCreate = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      window.location.href = "/auth";
      return;
    }
    const { id } = await createThread();
    window.location.href = `/chat/${id}`;
  };

  const handleRename = async (id: string) => {
    if (!title.trim()) return;
    await renameThread({ data: { id, title: title.trim() } });
    setEditing(null);
    setTitle("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this conversation?")) return;
    await deleteThread({ data: { id } });
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-background">
      <aside className="w-full max-w-[260px] border-r border-border/60 bg-card p-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleCreate}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-ice px-3 py-2 text-sm font-medium text-ice-foreground hover:bg-ice/90"
        >
          <Plus className="size-4" />
          New chat
        </button>
        <div className="mt-2 flex flex-1 flex-col gap-1 overflow-y-auto">
          {threads.length === 0 ? (
            <p className="px-2 text-xs text-muted-foreground">No conversations yet.</p>
          ) : (
            threads.map((thread) => (
              <div
                key={thread.id}
                className="group flex items-center gap-1 rounded-md hover:bg-accent"
              >
                {editing === thread.id ? (
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => handleRename(thread.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(thread.id);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    autoFocus
                    className="flex-1 rounded-md bg-background px-2 py-1 text-sm outline-none"
                  />
                ) : (
                  <Link
                    to="/chat/$threadId"
                    params={{ threadId: thread.id }}
                    className="flex flex-1 items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <MessageSquare className="size-4 shrink-0" />
                    <span className="truncate">{thread.title}</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(thread.id);
                    setTitle(thread.title);
                  }}
                  className="rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(thread.id)}
                  className="rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
