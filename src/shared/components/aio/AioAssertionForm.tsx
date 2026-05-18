"use client";

import { useCallback, useState } from "react";
import {
  RiAddLine,
  RiCloseLine,
  RiFlashlightFill,
  RiLinkM,
  RiShieldCheckLine,
} from "react-icons/ri";

import { CaptchaGate } from "@/shared/components/captcha/CaptchaGate";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";

type Props = {
  eventId: string;
  ruleId: string;
  outcomeOptions: string[];
  bondAmount: number;
  isLoggedIn: boolean;
  onSubmitted?: () => void;
};

type AioVerifyResponse = {
  error?: string;
};

export function AioAssertionForm({
  eventId,
  ruleId,
  outcomeOptions,
  bondAmount,
  isLoggedIn,
  onSubmitted,
}: Props) {
  const { dictionary, t } = useI18n();
  const a = dictionary.aio.assertion;

  const [claimText, setClaimText] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    claimText.trim().length >= 10 &&
    selectedOutcome &&
    evidenceUrls.some((u) => u.trim().startsWith("http"));

  const handleAddUrl = useCallback(() => {
    if (evidenceUrls.length < 5) setEvidenceUrls((prev) => [...prev, ""]);
  }, [evidenceUrls.length]);

  const handleRemoveUrl = useCallback((idx: number) => {
    setEvidenceUrls((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleUrlChange = useCallback((idx: number, val: string) => {
    setEvidenceUrls((prev) => prev.map((u, i) => (i === idx ? val : u)));
  }, []);

  const handleSubmit = useCallback(async (captchaToken: string | null) => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      // Server-side captcha verification
      if (captchaToken) {
        const captchaRes = await fetch("/api/captcha/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: captchaToken, action: "aio_assertion" }),
        });
        const captchaResult = (await captchaRes.json()) as { verified: boolean };
        if (!captchaResult.verified) {
          setError("Captcha verification failed");
          setSubmitting(false);
          return;
        }
      }

      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("auth");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: assertion, error: insertErr } = await (supabase as any)
        .from("aio_assertions")
        .insert({
          event_id: eventId,
          rule_id: ruleId,
          proposer_id: userData.user.id,
          claim_text: claimText.trim(),
          asserted_outcome: selectedOutcome,
          bond_amount: bondAmount,
          status: "submitted",
        })
        .select("id")
        .single();

      if (insertErr || !assertion) throw insertErr;

      const validUrls = evidenceUrls.filter((u) => u.trim().startsWith("http"));
      const { data: verifyData, error: verifyError } =
        await supabase.functions.invoke<AioVerifyResponse>("aio-verify", {
          body: {
            assertion_id: (assertion as { id: string }).id,
            evidence_urls: validUrls.map((url) => url.trim()),
          },
        });

      if (verifyError || verifyData?.error) {
        setError(t(a.verifyFailed));
      }

      setSuccess(true);
      onSubmitted?.();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }, [
    a.verifyFailed,
    bondAmount,
    claimText,
    eventId,
    evidenceUrls,
    isValid,
    onSubmitted,
    ruleId,
    selectedOutcome,
    submitting,
    t,
  ]);

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/5 px-6 py-8">
        <RiShieldCheckLine className="size-10 text-emerald-500" />
        <p className="text-lg font-black text-foreground">{t(a.success)}</p>
        <p className="text-center text-sm font-medium text-muted-foreground">
          {t(a.successDesc)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/80 bg-background p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <RiShieldCheckLine className="size-5 text-blue-500" />
        <h3 className="text-[15px] font-black text-foreground">{t(a.title)}</h3>
      </div>
      <p className="text-[13px] font-medium text-muted-foreground">{t(a.subtitle)}</p>

      {/* Outcome selection */}
      <div>
        <p className="mb-2 text-[12px] font-black text-foreground">{t(a.outcome)}</p>
        <div className="flex flex-wrap gap-2">
          {outcomeOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => setSelectedOutcome(opt)}
              className={`rounded-lg border px-3 py-1.5 text-[13px] font-bold transition-colors ${
                selectedOutcome === opt
                  ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                  : "border-border text-foreground hover:border-blue-400"
              }`}
            >
              {opt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Claim text */}
      <div>
        <p className="mb-2 text-[12px] font-black text-foreground">{t(a.claimText)}</p>
        <textarea
          value={claimText}
          onChange={(e) => setClaimText(e.target.value)}
          placeholder={t(a.claimPlaceholder)}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500 resize-none"
        />
      </div>

      {/* Evidence URLs */}
      <div>
        <p className="mb-2 text-[12px] font-black text-foreground">{t(a.evidenceUrls)}</p>
        <div className="space-y-2">
          {evidenceUrls.map((url, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <RiLinkM className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="url"
                value={url}
                onChange={(e) => handleUrlChange(idx, e.target.value)}
                placeholder={t(a.evidencePlaceholder)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500"
              />
              {evidenceUrls.length > 1 && (
                <button onClick={() => handleRemoveUrl(idx)} className="text-muted-foreground hover:text-foreground">
                  <RiCloseLine className="size-4" />
                </button>
              )}
            </div>
          ))}
          {evidenceUrls.length < 5 && (
            <button
              onClick={handleAddUrl}
              className="flex items-center gap-1 text-[12px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              <RiAddLine className="size-3.5" />
              {t(a.addEvidence)}
            </button>
          )}
        </div>
      </div>

      {/* Bond info */}
      <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <RiFlashlightFill className="size-4 text-amber-500" />
          <span className="text-[12px] font-black text-foreground">{t(a.bond)}</span>
        </div>
        <span className="text-sm font-black tabular-nums text-amber-600 dark:text-amber-400">
          {bondAmount} MOM Energy
        </span>
      </div>
      <p className="text-[11px] font-medium text-muted-foreground">{t(a.bondDesc)}</p>

      {error && (
        <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-[12px] font-bold text-rose-600">{error}</p>
      )}

      {/* hCaptcha + Submit */}
      <CaptchaGate action="aio_assertion">
        {({ captchaToken, isVerified, CaptchaWidget }) => (
          <>
            {CaptchaWidget}
            <button
              onClick={isLoggedIn ? () => handleSubmit(captchaToken) : undefined}
              disabled={!isLoggedIn || !isValid || submitting || !isVerified}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? t(a.verifying) : isLoggedIn ? t(a.submit) : t(a.loginRequired)}
            </button>
          </>
        )}
      </CaptchaGate>
    </div>
  );
}
