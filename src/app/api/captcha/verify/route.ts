import { NextResponse, type NextRequest } from "next/server";

const HCAPTCHA_SECRET =
  process.env.HCAPTCHA_SECRET || "0x0000000000000000000000000000000000000000";
const HCAPTCHA_VERIFY_URL = "https://api.hcaptcha.com/siteverify";

type VerifyResult = {
  verified: boolean;
  action?: string;
  error?: string;
};

/**
 * POST /api/captcha/verify
 *
 * Body: { token: string; action: string }
 *
 * Server-side hCaptcha token verification for bot prevention.
 * NOTE: hCaptcha publisher rewards (HMT) ended in 2023 — no revenue generated.
 */
export async function POST(request: NextRequest): Promise<NextResponse<VerifyResult>> {
  try {
    const body = (await request.json()) as { token?: string; action?: string };

    if (!body.token) {
      return NextResponse.json(
        { verified: false, error: "missing_token" },
        { status: 400 },
      );
    }

    const validActions = [
      "aio_assertion",
      "aio_challenge",
      "attention_build",
      "post_create",
    ];

    if (body.action && !validActions.includes(body.action)) {
      return NextResponse.json(
        { verified: false, error: "invalid_action" },
        { status: 400 },
      );
    }

    const formData = new URLSearchParams();
    formData.append("secret", HCAPTCHA_SECRET);
    formData.append("response", body.token);

    const hcaptchaResponse = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });

    const result = (await hcaptchaResponse.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (!result.success) {
      return NextResponse.json(
        {
          verified: false,
          error: `hcaptcha_failed: ${(result["error-codes"] ?? []).join(",")}`,
        },
        { status: 403 },
      );
    }

    // TODO: Record this verification in captcha_verifications table
    // for Trust Score calculation and Smart Captcha decisions

    return NextResponse.json({
      verified: true,
      action: body.action,
    });
  } catch {
    return NextResponse.json(
      { verified: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
