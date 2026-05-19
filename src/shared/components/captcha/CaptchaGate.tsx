"use client";

import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { RiShieldCheckLine } from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";

const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY || "10000000-ffff-ffff-ffff-000000000001";
const HCAPTCHA_ENABLED = process.env.NEXT_PUBLIC_HCAPTCHA_ENABLED === "true";

export type CaptchaAction =
  | "aio_assertion"
  | "aio_challenge"
  | "attention_build"
  | "post_create";

type Props = {
  action: CaptchaAction;
  /** If true, captcha is always shown (not conditional). Default: true */
  required?: boolean;
  /** Render prop: receives verified token and reset function */
  children: (ctx: {
    captchaToken: string | null;
    isVerified: boolean;
    CaptchaWidget: ReactNode;
    resetCaptcha: () => void;
  }) => ReactNode;
};

/**
 * CaptchaGate — Wraps a form action with hCaptcha verification.
 *
 * Usage:
 * ```tsx
 * <CaptchaGate action="aio_assertion">
 *   {({ captchaToken, isVerified, CaptchaWidget }) => (
 *     <>
 *       {CaptchaWidget}
 *       <button disabled={!isVerified} onClick={() => submit(captchaToken)}>
 *         Submit
 *       </button>
 *     </>
 *   )}
 * </CaptchaGate>
 * ```
 */
export function CaptchaGate({ action, required = true, children }: Props) {
  const { dictionary, t } = useI18n();
  const captchaRef = useRef<HCaptcha>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(!required);

  // Feature flag: when disabled, pass through as always-verified
  if (!HCAPTCHA_ENABLED) {
    return (
      <>
        {children({
          captchaToken: null,
          isVerified: true,
          CaptchaWidget: null,
          resetCaptcha: () => {},
        })}
      </>
    );
  }

  const handleVerify = useCallback((responseToken: string) => {
    setToken(responseToken);
    setIsVerified(true);
  }, []);

  const handleExpire = useCallback(() => {
    setToken(null);
    setIsVerified(false);
  }, []);

  const handleError = useCallback(() => {
    setToken(null);
    setIsVerified(false);
  }, []);

  const resetCaptcha = useCallback(() => {
    setToken(null);
    setIsVerified(false);
    captchaRef.current?.resetCaptcha();
  }, []);

  const CaptchaWidget = required ? (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <RiShieldCheckLine className="size-4 text-blue-500" />
        <span className="text-[12px] font-black text-foreground">
          {t(dictionary.captcha.title)}
        </span>
        {isVerified ? (
          <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
            {t(dictionary.captcha.verified)}
          </span>
        ) : null}
      </div>
      <div className="flex justify-center rounded-xl border border-border bg-zinc-50/50 p-3 dark:bg-zinc-900/30">
        <HCaptcha
          ref={captchaRef}
          sitekey={HCAPTCHA_SITE_KEY}
          onVerify={handleVerify}
          onExpire={handleExpire}
          onError={handleError}
          theme="dark"
          size="normal"
        />
      </div>
      <p className="text-[10px] font-medium text-muted-foreground">
        {t(dictionary.captcha.description)}
      </p>
    </div>
  ) : null;

  return (
    <>
      {children({
        captchaToken: token,
        isVerified,
        CaptchaWidget,
        resetCaptcha,
      })}
    </>
  );
}
