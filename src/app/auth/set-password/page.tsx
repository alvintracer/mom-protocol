"use client";

import { useMemo, useState, type FormEvent } from "react";
import { RiCheckLine, RiCloseLine, RiLockPasswordLine } from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import { checkPassword, isPasswordValid } from "@/shared/lib/password";

export default function SetPasswordPage() {
  const { dictionary, t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const checks = useMemo(() => checkPassword(password), [password]);
  const valid = isPasswordValid(password);

  function getSafeNextPath() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!valid) {
      setStatus("error");
      setMessage(t(dictionary.auth.pwRuleNotMet));
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage(t(dictionary.auth.passwordMismatch));
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setMessage(t(dictionary.auth.error));
      return;
    }

    setStatus("saved");
    setMessage(t(dictionary.auth.passwordSaved));
    window.location.assign(getSafeNextPath());
  }

  // No skip — password is mandatory

  const rules = [
    { key: "minLength" as const, label: t(dictionary.auth.pwRuleMinLength) },
    { key: "hasLetter" as const, label: t(dictionary.auth.pwRuleLetter) },
    { key: "hasNumber" as const, label: t(dictionary.auth.pwRuleNumber) },
    { key: "hasSpecial" as const, label: t(dictionary.auth.pwRuleSpecial) },
  ];

  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-md items-center justify-center p-4">
      <section className="w-full rounded-2xl border border-border bg-background p-6 shadow-sm">
        <p className="text-[13px] font-bold text-blue-500">
          {t(dictionary.auth.eyebrow)}
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground">
          {t(dictionary.auth.setPasswordTitle)}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          {t(dictionary.auth.setPasswordDesc)}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-[15px] font-bold text-foreground">
              {t(dictionary.auth.newPasswordLabel)}
            </span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t(dictionary.auth.passwordPlaceholder)}
              className="mt-2 h-12 w-full rounded-xl border border-border bg-zinc-50 px-4 text-[15px] outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500 focus:bg-background dark:bg-zinc-900"
            />
          </label>

          {/* Password rules checklist */}
          {password.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {rules.map((rule) => {
                const passed = checks[rule.key];
                return (
                  <div key={rule.key} className="flex items-center gap-1.5">
                    {passed ? (
                      <RiCheckLine className="size-3.5 text-emerald-500" />
                    ) : (
                      <RiCloseLine className="size-3.5 text-red-400" />
                    )}
                    <span
                      className={`text-xs font-bold ${
                        passed
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500 dark:text-red-400"
                      }`}
                    >
                      {rule.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          <label className="block">
            <span className="text-[15px] font-bold text-foreground">
              {t(dictionary.auth.confirmPasswordLabel)}
            </span>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t(dictionary.auth.passwordPlaceholder)}
              className="mt-2 h-12 w-full rounded-xl border border-border bg-zinc-50 px-4 text-[15px] outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500 focus:bg-background dark:bg-zinc-900"
            />
          </label>

          {/* Match indicator */}
          {confirmPassword.length > 0 && password !== confirmPassword ? (
            <p className="flex items-center gap-1.5 text-xs font-bold text-red-500">
              <RiCloseLine className="size-3.5" />
              {t(dictionary.auth.passwordMismatch)}
            </p>
          ) : null}

          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            disabled={status === "saving" || !valid || password !== confirmPassword}
          >
            <RiLockPasswordLine className="size-5" />
            {t(dictionary.auth.savePassword)}
          </button>
          <p className="text-xs font-semibold text-muted-foreground text-center">
            {t(dictionary.auth.passwordRequired)}
          </p>
        </form>

        {message ? (
          <p
            className={`mt-4 rounded-xl p-4 text-[13px] font-semibold ${
              status === "saved"
                ? "bg-blue-50 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400"
                : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
            }`}
          >
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
