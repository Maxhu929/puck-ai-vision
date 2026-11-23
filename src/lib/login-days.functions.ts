import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { maskName, rankLoginDays } from "./login-days";

/** Records today (UTC) for the signed-in user; repeat calls the same day are ignored. */
export const recordLoginDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string }).email;
    const { error } = await context.supabase
      .from("login_days")
      .upsert({ user_id: context.userId, display_name: maskName(email) }, { onConflict: "user_id,day", ignoreDuplicates: true });
    return { ok: !error };
  });

/** Leaderboard: days logged on per user, names masked. */
export const loginLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("login_days").select("user_id, display_name").limit(50000);
  return { rows: rankLoginDays(data ?? []).slice(0, 50).map((r, i) => ({ rank: i + 1, key: String(i), name: r.name, days: r.days })) };
});
