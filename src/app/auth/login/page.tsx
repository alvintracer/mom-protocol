"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  RiArrowLeftSLine,
  RiArrowRightLine,
  RiLockPasswordLine,
  RiMailLine,
  RiShieldCheckLine,
  RiUserAddLine,
} from "react-icons/ri";

import { createClient } from "@/shared/lib/supabase/client";
import { useI18n } from "@/shared/i18n/LanguageProvider";

const emailDomains = [
  "gmail.com",
  "naver.com",
  "kakao.com",
  "daum.net",
  "hanmail.net",
  "icloud.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "proton.me",
];
const codeTtlSeconds = 300;
const resendCooldownSeconds = 60;

/**
 * Auth flow:
 *   1. email  — user enters email
 *   2. choose — sign in or sign up
 *   3a. login_password — password input
 *   3b. login_otp / signup_otp — OTP sent, enter code
 *   4. otp_verify — verifying OTP code
 *   5. done — redirect
 */
type Step =
  | "email"
  | "choose"
  | "login_password"
  | "login_otp"
  | "signup_otp"
  | "otp_verify"
  | "forgot_password"
  | "done";

export default function LoginPage() {
  const { dictionary, t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [step, setStep] = useState<Step>("email");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const isOtpStep =
    step === "login_otp" || step === "signup_otp" || step === "otp_verify";

  useEffect(() => {
    if (!isOtpStep || (secondsLeft <= 0 && resendSecondsLeft <= 0)) return;

    const id = window.setInterval(() => {
      setSecondsLeft((c) => Math.max(c - 1, 0));
      setResendSecondsLeft((c) => Math.max(c - 1, 0));
    }, 1000);

    return () => window.clearInterval(id);
  }, [resendSecondsLeft, secondsLeft, isOtpStep]);

  function getSafeNextPath() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }

  function resetToEmail() {
    setStep("email");
    setPassword("");
    setCode("");
    setErrorMsg("");
    setSuccessMsg("");
    setSecondsLeft(0);
    setResendSecondsLeft(0);
  }

  // Basic email shape check: x@x.xx
  const isEmailReady = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  function handleEmailNext() {
    if (!isEmailReady) return;
    setErrorMsg("");
    setStep("choose");
  }

  // ── Sign in with password ──
  async function handlePasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(t(dictionary.auth.error));
      return;
    }

    setStep("done");
    window.location.assign(getSafeNextPath());
  }

  // ── Send OTP (for both login & signup) ──
  async function handleSendOtp(mode: "login_otp" | "signup_otp") {
    setIsSendingCode(true);
    setErrorMsg("");

    const supabase = createClient();

    // For signup, check if user already exists
    if (mode === "signup_otp") {
      const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      // If no error, user exists (OTP was sent to existing user)
      // We check: if we can send OTP without creating user, user exists
      if (!otpError) {
        // Sign out any accidental session
        await supabase.auth.signOut();
        setIsSendingCode(false);
        setErrorMsg(t(dictionary.auth.alreadyRegistered));
        return;
      }
      // If error contains "user not found" or similar, user doesn't exist → proceed
      // Otherwise it might be a rate limit or other error
      if (
        otpError.message?.includes("rate limit") ||
        (otpError as { code?: string }).code === "over_email_send_rate_limit"
      ) {
        setIsSendingCode(false);
        setErrorMsg(t(dictionary.auth.rateLimitError));
        return;
      }
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: mode === "signup_otp",
      },
    });

    setIsSendingCode(false);

    if (error) {
      if (
        error.message?.includes("rate limit") ||
        (error as { code?: string }).code === "over_email_send_rate_limit"
      ) {
        setErrorMsg(t(dictionary.auth.rateLimitError));
      } else {
        setErrorMsg(t(dictionary.auth.error));
      }
      return;
    }

    setCode("");
    setSecondsLeft(codeTtlSeconds);
    setResendSecondsLeft(resendCooldownSeconds);
    setStep(mode);
  }

  // ── Verify OTP code ──
  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (secondsLeft <= 0) return;

    setStep("otp_verify");
    setErrorMsg("");

    const prevStep = step; // login_otp or signup_otp
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });

    if (error) {
      setErrorMsg(t(dictionary.auth.error));
      setStep(prevStep as Step);
      return;
    }

    setStep("done");

    // If signup flow → always go to set password
    if (prevStep === "signup_otp") {
      const next = encodeURIComponent(getSafeNextPath());
      window.location.assign(`/auth/set-password?next=${next}`);
      return;
    }

    // Login OTP → check if new user (first time)
    const createdAt = data.user?.created_at
      ? new Date(data.user.created_at).getTime()
      : 0;
    const lastSignInAt = data.user?.last_sign_in_at
      ? new Date(data.user.last_sign_in_at).getTime()
      : 0;
    const isNewUser =
      createdAt > 0 &&
      lastSignInAt > 0 &&
      Math.abs(lastSignInAt - createdAt) < 120000;

    if (isNewUser) {
      const next = encodeURIComponent(getSafeNextPath());
      window.location.assign(`/auth/set-password?next=${next}`);
    } else {
      window.location.assign(getSafeNextPath());
    }
  }

  // ── Derived display values ──
  const fmtSeconds = `${Math.floor(secondsLeft / 60)}:${String(
    secondsLeft % 60,
  ).padStart(2, "0")}`;
  const fmtResend = `${Math.floor(resendSecondsLeft / 60)}:${String(
    resendSecondsLeft % 60,
  ).padStart(2, "0")}`;

  const domainQuery = email.includes("@") ? email.split("@").at(-1) ?? "" : "";
  const localPart = email.split("@")[0] ?? "";
  const domainSuggestions =
    step === "email" && email.includes("@") && localPart
      ? emailDomains
          .filter((d) => d.startsWith(domainQuery.toLowerCase()))
          .slice(0, 5)
      : [];

  function applyDomain(domain: string) {
    setEmail(`${localPart}@${domain}`);
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-md items-center justify-center p-4">
      <section className="w-full rounded-2xl border border-border bg-background p-6 shadow-sm">
        <p className="text-[13px] font-bold text-blue-500">
          {t(dictionary.auth.eyebrow)}
        </p>
        <h1 className="mt-1 text-2xl font-black text-foreground tracking-tight">
          {t(dictionary.auth.loginTitle)}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          {t(dictionary.auth.loginDesc)}
        </p>

        {/* ──────────────── Step 1: Email ──────────────── */}
        {step === "email" ? (
          <div className="mt-8 space-y-3">
            <label className="block">
              <span className="text-[15px] font-bold text-foreground">
                {t(dictionary.auth.emailLabel)}
              </span>
              <div className="relative mt-2">
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMsg("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleEmailNext();
                    }
                  }}
                  placeholder={t(dictionary.auth.emailPlaceholder)}
                  className="h-12 w-full rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900 px-4 pr-14 text-[15px] outline-none focus:border-blue-500 focus:bg-background transition-colors placeholder:text-muted-foreground"
                />
                {isEmailReady ? (
                  <button
                    type="button"
                    onClick={handleEmailNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-110 active:scale-95"
                  >
                    <RiArrowRightLine className="size-4" />
                  </button>
                ) : null}
              </div>
              {domainSuggestions.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {domainSuggestions.map((domain) => (
                    <button
                      key={domain}
                      type="button"
                      onClick={() => applyDomain(domain)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:border-blue-500 hover:text-blue-600"
                    >
                      @{domain}
                    </button>
                  ))}
                </div>
              ) : null}
              <span className="mt-2 block text-xs font-semibold text-muted-foreground">
                {t(dictionary.auth.emailDomainHelp)}
              </span>
            </label>
          </div>
        ) : null}

        {/* ──────────────── Step 2: Choose login / signup ──────────────── */}
        {step === "choose" ? (
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 border border-border">
              <RiMailLine className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate text-sm font-bold text-foreground">
                {email}
              </span>
              <button
                type="button"
                onClick={resetToEmail}
                className="text-xs font-bold text-blue-500 hover:text-blue-600"
              >
                {t(dictionary.auth.backToEmail)}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setStep("login_password")}
              className="flex h-14 w-full items-center gap-3 rounded-xl border border-border bg-background px-4 text-left transition-colors hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-500/5"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10">
                <RiLockPasswordLine className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-foreground">
                  {t(dictionary.auth.signInButton)}
                </p>
                <p className="text-[11px] font-medium text-muted-foreground">
                  {t(dictionary.auth.signInDesc)}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSendOtp("signup_otp")}
              disabled={isSendingCode}
              className="flex h-14 w-full items-center gap-3 rounded-xl border border-border bg-background px-4 text-left transition-colors hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5 disabled:opacity-50"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                <RiUserAddLine className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-foreground">
                  {t(dictionary.auth.signUpButton)}
                </p>
                <p className="text-[11px] font-medium text-muted-foreground">
                  {t(dictionary.auth.signUpDesc)}
                </p>
              </div>
            </button>
          </div>
        ) : null}

        {/* ──────────────── Step 3a: Password login ──────────────── */}
        {step === "login_password" ? (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 border border-border">
              <RiMailLine className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate text-sm font-bold text-foreground">
                {email}
              </span>
              <button
                type="button"
                onClick={resetToEmail}
                className="text-xs font-bold text-blue-500 hover:text-blue-600"
              >
                {t(dictionary.auth.backToEmail)}
              </button>
            </div>

            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <label className="block">
                <span className="text-[15px] font-bold text-foreground">
                  {t(dictionary.auth.passwordLabel)}
                </span>
                <input
                  type="password"
                  required
                  autoFocus
                  minLength={8}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg("");
                  }}
                  placeholder={t(dictionary.auth.passwordPlaceholder)}
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900 px-4 text-[15px] outline-none focus:border-blue-500 focus:bg-background transition-colors placeholder:text-muted-foreground"
                />
              </label>
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 transition-colors"
              >
                <RiLockPasswordLine className="size-5" />
                {t(dictionary.auth.passwordSignIn)}
              </button>
            </form>

            <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t(dictionary.auth.authDivider)}
              <span className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={() => handleSendOtp("login_otp")}
              disabled={isSendingCode}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background font-bold text-foreground hover:border-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50"
            >
              <RiMailLine className="size-5" />
              {t(dictionary.auth.emailCodeSignIn)}
            </button>

            <button
              type="button"
              onClick={() => setStep("forgot_password")}
              className="mt-1 w-full text-center text-[13px] font-bold text-muted-foreground hover:text-blue-500 transition-colors"
            >
              {t(dictionary.auth.forgotPassword)}
            </button>
          </div>
        ) : null}

        {/* ──────────────── Forgot Password ──────────────── */}
        {step === "forgot_password" ? (
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-black text-foreground">
              {t(dictionary.auth.resetPasswordTitle)}
            </h2>
            <p className="text-[13px] font-medium text-muted-foreground">
              {t(dictionary.auth.resetPasswordDesc)}
            </p>

            <div className="flex items-center gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 border border-border">
              <RiMailLine className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate text-sm font-bold text-foreground">
                {email}
              </span>
            </div>

            <button
              type="button"
              disabled={isSendingCode}
              onClick={async () => {
                setIsSendingCode(true);
                setErrorMsg("");
                const supabase = createClient();
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/auth/set-password`,
                });
                setIsSendingCode(false);
                if (error) {
                  setErrorMsg(t(dictionary.auth.error));
                } else {
                  setSuccessMsg(t(dictionary.auth.resetLinkSent));
                }
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RiMailLine className="size-5" />
              {t(dictionary.auth.sendResetLink)}
            </button>
          </div>
        ) : null}

        {/* ──────────────── Step 3b/4: OTP sent + verify ──────────────── */}
        {isOtpStep ? (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 border border-border">
              <RiMailLine className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate text-sm font-bold text-foreground">
                {email}
              </span>
              <button
                type="button"
                onClick={resetToEmail}
                className="text-xs font-bold text-blue-500 hover:text-blue-600"
              >
                {t(dictionary.auth.backToEmail)}
              </button>
            </div>

            <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 p-4">
              <p className="text-[13px] font-semibold text-blue-800 dark:text-blue-400">
                {t(dictionary.auth.sent)}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[13px] font-black text-blue-800 dark:text-blue-400">
                  {t(dictionary.auth.codeExpiresIn)} {fmtSeconds}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleSendOtp(
                      step === "signup_otp" ? "signup_otp" : "login_otp",
                    )
                  }
                  disabled={resendSecondsLeft > 0 || isSendingCode}
                  className="rounded-full border border-blue-200 bg-background px-3 py-1.5 text-xs font-black text-blue-700 transition-colors hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500/30 dark:text-blue-400"
                >
                  {resendSecondsLeft > 0
                    ? `${t(dictionary.auth.resendAvailableIn)} ${fmtResend}`
                    : t(dictionary.auth.resendCode)}
                </button>
              </div>
              {secondsLeft <= 0 ? (
                <p className="mt-3 text-[13px] font-semibold text-blue-800 dark:text-blue-400">
                  {t(dictionary.auth.codeExpired)}
                </p>
              ) : null}
            </div>

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <label className="block">
                <span className="text-[15px] font-bold text-foreground">
                  {t(dictionary.auth.codeLabel)}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  autoFocus
                  minLength={6}
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder={t(dictionary.auth.codePlaceholder)}
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900 px-4 text-center text-[18px] font-black tracking-[0.35em] outline-none focus:border-blue-500 focus:bg-background transition-colors placeholder:text-[15px] placeholder:font-semibold placeholder:tracking-normal placeholder:text-muted-foreground"
                  disabled={secondsLeft <= 0}
                />
              </label>
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={
                  step === "otp_verify" ||
                  code.length !== 6 ||
                  secondsLeft <= 0
                }
              >
                <RiShieldCheckLine className="size-5" />
                {t(dictionary.auth.verifyCode)}
              </button>
            </form>
          </div>
        ) : null}

        {/* ──────────────── Messages ──────────────── */}
        {errorMsg ? (
          <p className="mt-4 rounded-xl bg-red-50 dark:bg-red-500/10 p-4 text-[13px] font-semibold text-red-700 dark:text-red-400">
            {errorMsg}
          </p>
        ) : null}
        {successMsg ? (
          <p className="mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-4 text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
            {successMsg}
          </p>
        ) : null}

        {/* ──────────────── Back button (when not on email step) ──────────────── */}
        {step !== "email" && step !== "done" ? (
          <button
            type="button"
            onClick={resetToEmail}
            className="mt-4 flex items-center gap-1 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            <RiArrowLeftSLine className="size-4" />
            {t(dictionary.auth.backToEmail)}
          </button>
        ) : null}
      </section>
    </div>
  );
}
