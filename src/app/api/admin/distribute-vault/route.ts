import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/shared/lib/admin/session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (!isValidAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    distribution_rate?: number;
    min_energy?: number;
  };

  const rate = body.distribution_rate ?? 0.5;
  const minEnergy = body.min_energy ?? 1;

  if (rate < 0 || rate > 1) {
    return NextResponse.json({ error: "distribution_rate must be 0~1" }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase.rpc("distribute_vault_energy", {
    p_distribution_rate: rate,
    p_min_energy: minEnergy,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
