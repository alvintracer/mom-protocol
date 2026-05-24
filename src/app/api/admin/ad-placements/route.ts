import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

import {
  ADMIN_COOKIE_NAME,
  isValidAdminSession,
} from "@/shared/lib/admin/session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return isValidAdminSession(token);
}

// GET: list all placements
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase
    .from("ad_network_placements")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ placements: data });
}

// POST: create new placement
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from("ad_network_placements")
    .insert({
      network_name: body.network_name,
      unit_name: body.unit_name,
      unit_type: body.unit_type ?? "script",
      position: body.position ?? "sidebar",
      script_code: body.script_code,
      is_active: body.is_active ?? true,
      priority: body.priority ?? 0,
      notes: body.notes ?? null,
      device: body.device ?? "all",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ placement: data });
}

// PATCH: update placement
export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.network_name !== undefined) updates.network_name = body.network_name;
  if (body.unit_name !== undefined) updates.unit_name = body.unit_name;
  if (body.unit_type !== undefined) updates.unit_type = body.unit_type;
  if (body.position !== undefined) updates.position = body.position;
  if (body.script_code !== undefined) updates.script_code = body.script_code;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.device !== undefined) updates.device = body.device;

  const { data, error } = await supabase
    .from("ad_network_placements")
    .update(updates)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ placement: data });
}

// DELETE: remove placement
export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { error } = await supabase.from("ad_network_placements").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
