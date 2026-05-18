import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || "";

function verifySignature(body: string, signature: string | null): boolean {
  if (!NOWPAYMENTS_IPN_SECRET || !signature) return false;

  const hmac = crypto.createHmac("sha512", NOWPAYMENTS_IPN_SECRET);
  // NOWPayments sorts keys before hashing
  const sorted = JSON.stringify(
    Object.fromEntries(
      Object.entries(JSON.parse(body)).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
  hmac.update(sorted);
  return hmac.digest("hex") === signature;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-nowpayments-sig");

    // Verify IPN signature in production
    if (NOWPAYMENTS_IPN_SECRET && !verifySignature(rawBody, signature)) {
      console.error("IPN signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const data = JSON.parse(rawBody) as {
      payment_id: number;
      invoice_id: number;
      payment_status: string;
      pay_amount: number;
      pay_currency: string;
      order_id: string;
      price_amount: number;
      price_currency: string;
    };

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Map NOWPayments status to our status
    const statusMap: Record<string, string> = {
      waiting: "pending",
      confirming: "confirming",
      confirmed: "confirmed",
      sending: "sending",
      partially_paid: "confirming",
      finished: "finished",
      failed: "failed",
      refunded: "refunded",
      expired: "expired",
    };

    const mappedStatus = statusMap[data.payment_status] ?? "pending";

    // Update payment record
    const { data: payment, error: updateError } = await supabase
      .from("payments")
      .update({
        provider_payment_id: String(data.payment_id),
        pay_amount: data.pay_amount,
        pay_currency: data.pay_currency,
        status: mappedStatus,
        callback_data: data,
      })
      .eq("provider_invoice_id", String(data.invoice_id))
      .select("id, user_id, mom_energy_amount, status")
      .single();

    if (updateError) {
      console.error("IPN update error:", updateError);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    // Credit MOM Energy when payment is finished
    if (mappedStatus === "finished" && payment) {
      const { error: creditError } = await supabase.rpc(
        "credit_mom_energy_for_payment",
        { target_payment_id: payment.id },
      );

      if (creditError) {
        console.error("MOM Energy credit error:", creditError);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("IPN handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
