import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/rate
 * Returns the current dynamic MOM rate ($/MOM) and vault stats
 * including 90/10 split (distributable vs operations).
 * Public endpoint — no auth required.
 */
export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase
    .from("platform_vault_overview")
    .select(
      "vault_usd, distributable_usd, operations_usd, distribution_pct, operations_pct, total_mom_supply, current_rate",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rate = Number(data?.current_rate ?? 0.001);
  const vaultUsd = Number(data?.vault_usd ?? 0);
  const distributableUsd = Number(data?.distributable_usd ?? 0);
  const operationsUsd = Number(data?.operations_usd ?? 0);
  const totalMomSupply = Number(data?.total_mom_supply ?? 0);

  return NextResponse.json({
    rate,
    vault_usd: vaultUsd,
    distributable_usd: distributableUsd,
    operations_usd: operationsUsd,
    distribution_pct: Number(data?.distribution_pct ?? 90),
    operations_pct: Number(data?.operations_pct ?? 10),
    total_mom_supply: totalMomSupply,
    mom_per_usd: rate > 0 ? 1 / rate : 1000,
    mock_usdc_address: process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS ?? null,
    chain: {
      name: "Giwa Sepolia",
      id: 91342,
      rpc: process.env.NEXT_PUBLIC_GIWA_RPC_URL ?? "https://sepolia-rpc.giwa.io",
    },
  });
}
