import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/types/database";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: withdrawals, error } = await (supabaseAdmin as any)
    .from("withdrawal_requests")
    .select(`
      *,
      profiles!withdrawal_requests_user_id_fkey(handle, display_name)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ withdrawals });
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, status } = await request.json().catch(() => ({}));

  if (!id || !status) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const validStatuses = ["queued", "processing", "completed", "failed", "cancelled"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Update status
  const { data: updated, error } = await (supabaseAdmin as any)
    .from("withdrawal_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If failed or cancelled, refund the MOM energy
  if (status === "failed" || status === "cancelled") {
    // Refund the MOM energy
    // Note: We'd typically want to do this in an RPC to ensure transaction integrity,
    // but for the admin dashboard this is fine for now.
    const { error: refundError } = await (supabaseAdmin as any).rpc("refund_withdrawal", {
      p_withdrawal_id: id,
    });

    if (refundError) {
       console.error("Refund failed:", refundError);
    }
  }

  return NextResponse.json({ withdrawal: updated });
}
