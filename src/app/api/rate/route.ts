import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/rate
 * Returns the current dynamic MOM rate ($/MOM) and vault stats.
 * Public endpoint — no auth required.
 */
export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase
    .from("platform_vault_overview")
    .select("vault_usd, total_mom_supply, current_rate")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rate: Number(data?.current_rate ?? 0.001),
    vault_usd: Number(data?.vault_usd ?? 0),
    total_mom_supply: Number(data?.total_mom_supply ?? 0),
    mom_per_usd: data?.current_rate ? 1 / Number(data.current_rate) : 1000,
  });
}
