import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/shared/lib/admin/session";

const ADMIN_SECRET = process.env.PLATFORM_REVENUE_ADMIN_SECRET || "";

type RevenueBody = {
  source_type:
    | "adsense"
    | "advertiser_direct"
    | "creator_subscription"
    | "attention_boost"
    | "super_comment"
    | "sponsor_campaign"
    | "data_api"
    | "manual_adjustment"
    | "other";
  gross_amount: number;
  currency?: string;
  energy_amount?: number;
  vault_share_rate?: number;
  source_id?: string;
  revenue_month?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const hasAdminSession = isValidAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
    const token = req.headers.get("x-platform-revenue-secret");

    if (!ADMIN_SECRET && !hasAdminSession) {
      return NextResponse.json(
        { error: "Admin auth is not configured" },
        { status: 500 },
      );
    }

    if (!hasAdminSession && token !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as RevenueBody;
    if (!body.source_type || !Number.isFinite(Number(body.gross_amount))) {
      return NextResponse.json(
        { error: "source_type and gross_amount are required" },
        { status: 400 },
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data, error } = await supabase.rpc("record_platform_revenue", {
      p_source_type: body.source_type,
      p_gross_amount: Number(body.gross_amount),
      p_currency: body.currency ?? "USD",
      p_energy_amount:
        body.energy_amount == null ? null : Number(body.energy_amount),
      p_vault_share_rate:
        body.vault_share_rate == null ? 1 : Number(body.vault_share_rate),
      p_source_id: body.source_id ?? null,
      p_payment_id: null,
      p_user_id: null,
      p_revenue_month: body.revenue_month ?? null,
      p_metadata: body.metadata ?? {},
    });

    if (error) {
      console.error("Platform revenue insert error:", error);
      return NextResponse.json({ error: "Failed to record revenue" }, { status: 500 });
    }

    return NextResponse.json({ id: data });
  } catch (error) {
    console.error("Platform revenue route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
