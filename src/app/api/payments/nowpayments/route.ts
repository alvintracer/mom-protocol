import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || "";
const NOWPAYMENTS_API_URL = process.env.NOWPAYMENTS_SANDBOX === "true"
  ? "https://api-sandbox.nowpayments.io/v1"
  : "https://api.nowpayments.io/v1";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount_usd, pay_currency, user_id } = body as {
      amount_usd: number;
      pay_currency: string;
      user_id: string;
    };

    if (!amount_usd || amount_usd < 1 || !user_id) {
      return NextResponse.json(
        { error: "Missing required fields: amount_usd (min $1), user_id" },
        { status: 400 },
      );
    }

    if (!NOWPAYMENTS_API_KEY) {
      return NextResponse.json(
        { error: "NOWPayments API key not configured" },
        { status: 500 },
      );
    }

    // Dynamic rate: fetch current $/MOM from vault
    const supabaseForRate = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: rateData } = await supabaseForRate.rpc("get_mom_rate");
    const momRate = Number(rateData) || 0.001;
    const momEnergyAmount = Math.floor(amount_usd / momRate);

    // Build invoice payload — omit pay_currency so the user picks on the
    // NOWPayments payment page (some currencies may be temporarily unavailable).
    const invoicePayload: Record<string, unknown> = {
      price_amount: amount_usd,
      price_currency: "usd",
      order_id: `mom_${user_id}_${Date.now()}`,
      order_description: `${momEnergyAmount} MOM Energy`,
      ipn_callback_url: `${APP_URL}/api/payments/nowpayments/ipn`,
      success_url: `${APP_URL}/profile?payment=success`,
      cancel_url: `${APP_URL}/profile?payment=cancelled`,
    };

    // Only attach pay_currency if provided and non-empty
    if (pay_currency) {
      invoicePayload.pay_currency = pay_currency;
    }

    // 1. Create NOWPayments invoice
    const invoiceRes = await fetch(`${NOWPAYMENTS_API_URL}/invoice`, {
      method: "POST",
      headers: {
        "x-api-key": NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invoicePayload),
    });

    if (!invoiceRes.ok) {
      const errBody = await invoiceRes.text();
      console.error("NOWPayments invoice error:", invoiceRes.status, errBody);

      // If the chosen currency is unavailable, retry without pay_currency
      if (invoicePayload.pay_currency && errBody.includes("unavailable")) {
        delete invoicePayload.pay_currency;
        const retryRes = await fetch(`${NOWPAYMENTS_API_URL}/invoice`, {
          method: "POST",
          headers: {
            "x-api-key": NOWPAYMENTS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invoicePayload),
        });

        if (!retryRes.ok) {
          const retryErr = await retryRes.text();
          console.error("NOWPayments retry error:", retryErr);
          return NextResponse.json(
            { error: "Failed to create payment invoice" },
            { status: 502 },
          );
        }

        const retryData = await retryRes.json();
        return await saveAndReturn(retryData, user_id, amount_usd, pay_currency, momEnergyAmount);
      }

      return NextResponse.json(
        { error: "Failed to create payment invoice" },
        { status: 502 },
      );
    }

    const invoiceData = await invoiceRes.json();
    return await saveAndReturn(invoiceData, user_id, amount_usd, pay_currency, momEnergyAmount);
  } catch (error) {
    console.error("Payment creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function saveAndReturn(
  invoiceData: { id: string | number; invoice_url: string },
  userId: string,
  amountUsd: number,
  payCurrency: string,
  momEnergyAmount: number,
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: payment, error: dbError } = await supabase
    .from("payments")
    .insert({
      user_id: userId,
      provider: "nowpayments",
      provider_invoice_id: String(invoiceData.id),
      amount_fiat: amountUsd,
      fiat_currency: "USD",
      pay_currency: payCurrency || null,
      mom_energy_amount: momEnergyAmount,
      status: "pending",
      callback_data: invoiceData,
    })
    .select("id")
    .single();

  if (dbError) {
    console.error("DB insert error:", dbError);
    return NextResponse.json(
      { error: "Failed to save payment record" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    payment_id: payment.id,
    invoice_url: invoiceData.invoice_url,
    mom_energy_amount: momEnergyAmount,
  });
}
