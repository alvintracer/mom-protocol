import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/shared/lib/admin/session";

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function requireAdmin() {
  const cookieStore = await cookies();
  return isValidAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const supabase = createServiceClient();
  let request = supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url, mom_energy, follower_count, following_count, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (query) {
    const pattern = `%${query}%`;
    const filters = [`handle.ilike.${pattern}`, `display_name.ilike.${pattern}`];
    if (isUuid(query)) {
      filters.push(`id.eq.${query}`);
    }
    request = request.or(filters.join(","));
  }

  const { data, error } = await request;

  if (error) {
    console.error("Admin user search error:", error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    user_id?: string;
    mom_energy_delta?: number;
    reason?: string;
  };

  if (!body.user_id || !Number.isFinite(Number(body.mom_energy_delta))) {
    return NextResponse.json(
      { error: "user_id and mom_energy_delta are required" },
      { status: 400 },
    );
  }

  const delta = Number(body.mom_energy_delta);
  const supabase = createServiceClient();

  const { data: profile, error: loadError } = await supabase
    .from("profiles")
    .select("id, mom_energy")
    .eq("id", body.user_id)
    .single();

  if (loadError || !profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const nextEnergy = Math.max(0, Number(profile.mom_energy ?? 0) + delta);

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ mom_energy: nextEnergy, updated_at: new Date().toISOString() })
    .eq("id", body.user_id)
    .select("id, handle, display_name, avatar_url, mom_energy, follower_count, following_count, created_at, updated_at")
    .single();

  if (updateError) {
    console.error("Admin MOM update error:", updateError);
    return NextResponse.json({ error: "Failed to update MOM" }, { status: 500 });
  }

  const { error: auditError } = await supabase.from("admin_user_actions").insert({
    target_user_id: body.user_id,
    action_type: "mom_energy_adjustment",
    mom_energy_delta: delta,
    reason: body.reason?.trim() || null,
    metadata: {
      before: Number(profile.mom_energy ?? 0),
      after: nextEnergy,
    },
  });

  if (auditError) {
    console.error("Admin action audit error:", auditError);
  }

  return NextResponse.json({ user: updated });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
