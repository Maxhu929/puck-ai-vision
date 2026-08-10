import { createFileRoute, redirect } from "@tanstack/react-router";
import { createThread } from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/chat/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { id } = await createThread();
    throw redirect({ to: "/chat/$threadId", params: { threadId: id } });
  },
});
