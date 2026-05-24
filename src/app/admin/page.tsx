"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";

import { useI18n } from "@/shared/i18n/LanguageProvider";

const revenueSources = [
  { value: "adsense", labelKey: "sourceAdsense" },
  { value: "advertiser_direct", labelKey: "sourceAdvertiserDirect" },
  { value: "sponsor_campaign", labelKey: "sourceSponsorCampaign" },
  { value: "data_api", labelKey: "sourceDataApi" },
  { value: "manual_adjustment", labelKey: "sourceManualAdjustment" },
  { value: "other", labelKey: "sourceOther" },
] as const;

type AdminUser = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  mom_energy: number;
  follower_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
};

export default function AdminPage() {
  const { dictionary, t } = useI18n();
  const a = dictionary.admin;
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userNotice, setUserNotice] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [energyDelta, setEnergyDelta] = useState("100");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [form, setForm] = useState({
    sourceType: "adsense",
    grossAmount: "",
    currency: "USD",
    energyAmount: "",
    vaultShare: "1",
    sourceId: "",
    revenueMonth: new Date().toISOString().slice(0, 7),
    memo: "",
  });

  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => res.json())
      .then((data) => setAuthenticated(Boolean(data.authenticated)))
      .finally(() => setChecking(false));
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      setNotice(t(a.invalidPassword));
      return;
    }

    setAuthenticated(true);
    setPassword("");
  }

  async function handleLogout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthenticated(false);
  }

  async function handleRevenueSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    const res = await fetch("/api/platform-revenue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_type: form.sourceType,
        gross_amount: Number(form.grossAmount),
        currency: form.currency,
        energy_amount: form.energyAmount ? Number(form.energyAmount) : undefined,
        vault_share_rate: Number(form.vaultShare),
        source_id: form.sourceId || undefined,
        revenue_month: `${form.revenueMonth}-01`,
        metadata: form.memo ? { memo: form.memo } : {},
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNotice(data.error ?? "Failed");
      return;
    }

    setNotice(t(a.saved));
    setForm((current) => ({
      ...current,
      grossAmount: "",
      energyAmount: "",
      sourceId: "",
      memo: "",
    }));
  }

  async function handleUserSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setUserLoading(true);
    setUserNotice(null);

    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(userQuery)}`);
    const data = await res.json().catch(() => ({}));
    setUserLoading(false);

    if (!res.ok) {
      setUserNotice(data.error ?? "Failed");
      return;
    }

    setUsers((data.users as AdminUser[]) ?? []);
  }

  async function handleEnergyAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser) return;

    setUserSaving(true);
    setUserNotice(null);

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: selectedUser.id,
        mom_energy_delta: Number(energyDelta),
        reason: adjustmentReason,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setUserSaving(false);

    if (!res.ok) {
      setUserNotice(data.error ?? "Failed");
      return;
    }

    const updated = data.user as AdminUser;
    setSelectedUser(updated);
    setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
    setAdjustmentReason("");
    setUserNotice(t(a.userUpdated));
  }

  if (checking) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="h-32 animate-pulse rounded-2xl border border-border bg-zinc-100 dark:bg-zinc-900" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4">
        <form onSubmit={handleLogin} className="w-full rounded-2xl border border-border bg-background p-5 shadow-sm">
          <h1 className="text-2xl font-black text-foreground">{t(a.title)}</h1>
          <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">{t(a.subtitle)}</p>
          <label className="mt-5 block text-[12px] font-black text-foreground">{t(a.password)}</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-zinc-50 px-3 text-sm font-bold text-foreground outline-none focus:border-blue-500 dark:bg-zinc-900/50"
          />
          {notice ? <p className="mt-3 text-sm font-bold text-rose-600">{notice}</p> : null}
          <button className="mt-5 h-11 w-full rounded-full bg-blue-600 text-sm font-black text-white transition-colors hover:bg-blue-700">
            {t(a.signIn)}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 pb-20 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-foreground">{t(a.title)}</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">{t(a.subtitle)}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-border px-4 py-2 text-sm font-black text-foreground transition-colors hover:border-blue-500 hover:text-blue-600"
        >
          {t(a.signOut)}
        </button>
      </div>

      <section className="rounded-2xl border border-border bg-background p-5 shadow-sm">
        <h2 className="text-lg font-black text-foreground">{t(a.revenueSection)}</h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">{t(a.revenueDesc)}</p>

        <form onSubmit={handleRevenueSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label={t(a.sourceType)}>
            <select
              value={form.sourceType}
              onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value }))}
              className="h-11 w-full rounded-xl border border-border bg-zinc-50 px-3 text-sm font-bold text-foreground outline-none dark:bg-zinc-900/50"
            >
              {revenueSources.map((source) => (
                <option key={source.value} value={source.value}>
                  {t(a[source.labelKey])}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t(a.grossAmount)}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.grossAmount}
              onChange={(event) => setForm((current) => ({ ...current, grossAmount: event.target.value }))}
              className="h-11 w-full rounded-xl border border-border bg-zinc-50 px-3 text-sm font-bold text-foreground outline-none dark:bg-zinc-900/50"
              required
            />
          </Field>

          <Field label={t(a.currency)}>
            <input
              value={form.currency}
              onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
              className="h-11 w-full rounded-xl border border-border bg-zinc-50 px-3 text-sm font-bold text-foreground outline-none dark:bg-zinc-900/50"
            />
          </Field>

          <Field label={t(a.energyAmount)} hint={t(a.energyHint)}>
            <input
              type="number"
              min="0"
              step="1"
              value={form.energyAmount}
              onChange={(event) => setForm((current) => ({ ...current, energyAmount: event.target.value }))}
              className="h-11 w-full rounded-xl border border-border bg-zinc-50 px-3 text-sm font-bold text-foreground outline-none dark:bg-zinc-900/50"
            />
          </Field>

          <Field label={t(a.vaultShare)}>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={form.vaultShare}
              onChange={(event) => setForm((current) => ({ ...current, vaultShare: event.target.value }))}
              className="h-11 w-full rounded-xl border border-border bg-zinc-50 px-3 text-sm font-bold text-foreground outline-none dark:bg-zinc-900/50"
            />
          </Field>

          <Field label={t(a.revenueMonth)}>
            <input
              type="month"
              value={form.revenueMonth}
              onChange={(event) => setForm((current) => ({ ...current, revenueMonth: event.target.value }))}
              className="h-11 w-full rounded-xl border border-border bg-zinc-50 px-3 text-sm font-bold text-foreground outline-none dark:bg-zinc-900/50"
            />
          </Field>

          <Field label={t(a.sourceId)}>
            <input
              value={form.sourceId}
              onChange={(event) => setForm((current) => ({ ...current, sourceId: event.target.value }))}
              className="h-11 w-full rounded-xl border border-border bg-zinc-50 px-3 text-sm font-bold text-foreground outline-none dark:bg-zinc-900/50"
            />
          </Field>

          <Field label={t(a.memo)}>
            <input
              value={form.memo}
              onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
              className="h-11 w-full rounded-xl border border-border bg-zinc-50 px-3 text-sm font-bold text-foreground outline-none dark:bg-zinc-900/50"
            />
          </Field>

          <div className="sm:col-span-2">
            {notice ? <p className="mb-3 text-sm font-bold text-blue-600">{notice}</p> : null}
            <button
              disabled={saving}
              className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-black text-background transition-transform hover:scale-105 disabled:opacity-50"
            >
              {saving ? t(a.saving) : t(a.submit)}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-background p-5 shadow-sm">
        <h2 className="text-lg font-black text-foreground">{t(a.userSection)}</h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">{t(a.userDesc)}</p>

        <form onSubmit={handleUserSearch} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            value={userQuery}
            onChange={(event) => setUserQuery(event.target.value)}
            placeholder={t(a.userSearch)}
            className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-zinc-50 px-3 text-sm font-bold text-foreground outline-none focus:border-blue-500 dark:bg-zinc-900/50"
          />
          <button
            disabled={userLoading}
            className="h-11 rounded-full bg-blue-600 px-5 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {userLoading ? t(a.saving) : t(a.search)}
          </button>
        </form>

        {userNotice ? <p className="mt-3 text-sm font-bold text-blue-600">{userNotice}</p> : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-2xl border border-border">
            {users.length > 0 ? (
              <div className="divide-y divide-border">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUser(user)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40 ${
                      selectedUser?.id === user.id ? "bg-blue-50/60 dark:bg-blue-500/10" : ""
                    }`}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-900 text-xs font-black text-white dark:bg-zinc-100 dark:text-zinc-950">
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatar_url} alt="" className="size-full object-cover" />
                      ) : (
                        initial(user.display_name ?? user.handle ?? user.id)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-foreground">
                        {user.display_name || user.handle || user.id.slice(0, 8)}
                      </p>
                      <p className="truncate text-xs font-semibold text-muted-foreground">
                        u/{user.handle ?? "unknown"} · {Math.round(Number(user.mom_energy ?? 0)).toLocaleString()} MOM
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="p-5 text-sm font-semibold text-muted-foreground">{t(a.noUsers)}</p>
            )}
          </div>

          <form onSubmit={handleEnergyAdjustment} className="rounded-2xl border border-border p-4">
            <h3 className="text-sm font-black text-foreground">{t(a.selectedUser)}</h3>
            {selectedUser ? (
              <>
                <p className="mt-2 text-sm font-black text-foreground">
                  {selectedUser.display_name || selectedUser.handle || selectedUser.id.slice(0, 8)}
                </p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {Math.round(Number(selectedUser.mom_energy ?? 0)).toLocaleString()} MOM
                </p>
                <div className="mt-4 space-y-3">
                  <Field label={t(a.energyDelta)}>
                    <input
                      type="number"
                      step="1"
                      value={energyDelta}
                      onChange={(event) => setEnergyDelta(event.target.value)}
                      className="h-11 w-full rounded-xl border border-border bg-zinc-50 px-3 text-sm font-bold text-foreground outline-none dark:bg-zinc-900/50"
                    />
                  </Field>
                  <Field label={t(a.adjustmentReason)}>
                    <input
                      value={adjustmentReason}
                      onChange={(event) => setAdjustmentReason(event.target.value)}
                      className="h-11 w-full rounded-xl border border-border bg-zinc-50 px-3 text-sm font-bold text-foreground outline-none dark:bg-zinc-900/50"
                    />
                  </Field>
                  <button
                    disabled={userSaving || !Number.isFinite(Number(energyDelta))}
                    className="h-11 w-full rounded-full bg-foreground text-sm font-black text-background transition-transform hover:scale-[1.02] disabled:opacity-50"
                  >
                    {userSaving ? t(a.saving) : t(a.grantEnergy)}
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm font-semibold text-muted-foreground">{t(a.noUsers)}</p>
            )}
          </form>
        </div>
      </section>

      {/* ─── Batch Translation ─── */}
      <section className="rounded-2xl border border-border bg-background p-5 shadow-sm">
        <h2 className="text-lg font-black text-foreground">번역 배치 관리</h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
          포스트/댓글 번역을 배치로 실행합니다 (GPT-4o-mini, 최대 50개/회)
        </p>
        <TranslationPanel />
      </section>

      {/* ─── Withdrawal Queue Management ─── */}
      <section className="rounded-2xl border border-border bg-background p-5 shadow-sm">
        <h2 className="text-lg font-black text-foreground">출금 큐 관리</h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
          유저들의 MOM 출금 요청을 승인하거나 거절(취소)합니다.
        </p>
        <WithdrawalQueuePanel />
      </section>

      {/* ─── Ad Network Management ─── */}
      <section className="rounded-2xl border border-border bg-background p-5 shadow-sm">
        <h2 className="text-lg font-black text-foreground">광고 네트워크 관리</h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
          Adsterra, AdSense 등 외부 광고 네트워크 스크립트를 관리합니다. 스크립트 코드를 직접 붙여넣으세요.
        </p>
        <AdNetworkPanel />
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-black text-foreground">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] font-semibold text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function initial(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "m";
}

/* ── Translation Panel ─────────────────────────────────────── */

function TranslationPanel() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{
    batchSize?: number;
    translated?: number;
    remainingPending?: number;
    contentTypes?: string[];
    errors?: string[];
    message?: string;
    error?: string;
  }[]>([]);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [intervalMin, setIntervalMin] = useState(60);
  const [timerRef, setTimerRef] = useState<ReturnType<typeof setInterval> | null>(null);
  const [looping, setLooping] = useState(false);

  async function runBatch(): Promise<{ remainingPending: number }> {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/batch-translate", { method: "POST" });
      const data = await res.json();
      setResults((prev) => [data, ...prev].slice(0, 10));
      setRunning(false);
      return { remainingPending: data.remainingPending ?? 0 };
    } catch (err) {
      setResults((prev) => [{ error: String(err) }, ...prev].slice(0, 10));
      setRunning(false);
      return { remainingPending: 0 };
    }
  }

  async function runAll() {
    setLooping(true);
    setResults([]);
    let remaining = Infinity;
    let rounds = 0;
    const MAX_ROUNDS = 20; // safety limit

    while (remaining > 0 && rounds < MAX_ROUNDS) {
      rounds++;
      const result = await runBatch();
      remaining = result.remainingPending;
      if (remaining > 0) {
        // Small delay between batches to avoid rate limits
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    setLooping(false);
  }

  function toggleAuto() {
    if (autoEnabled) {
      if (timerRef) clearInterval(timerRef);
      setTimerRef(null);
      setAutoEnabled(false);
    } else {
      runBatch();
      const id = setInterval(runBatch, intervalMin * 60 * 1000);
      setTimerRef(id);
      setAutoEnabled(true);
    }
  }

  const latest = results[0];

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <button
          onClick={() => runBatch()}
          disabled={running || looping}
          className="h-11 rounded-full bg-blue-600 px-6 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {running ? "번역 중..." : "배치 1회 실행"}
        </button>
        <button
          onClick={runAll}
          disabled={running || looping}
          className="h-11 rounded-full bg-foreground px-6 text-sm font-black text-background transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {looping ? `전체 번역 중... (${results.length}회 완료)` : "⚡ 전체 번역 (pending → 0)"}
        </button>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-foreground">
            <input
              type="checkbox"
              checked={autoEnabled}
              onChange={toggleAuto}
              className="size-4 accent-blue-600"
            />
            자동 반복
          </label>
          <input
            type="number"
            min={1}
            value={intervalMin}
            onChange={(e) => setIntervalMin(Number(e.target.value))}
            disabled={autoEnabled}
            className="h-9 w-20 rounded-lg border border-border bg-zinc-50 px-2 text-center text-sm font-bold dark:bg-zinc-900/50"
          />
          <span className="text-xs font-semibold text-muted-foreground">분 간격</span>
        </div>
      </div>

      {autoEnabled && (
        <p className="text-xs font-bold text-green-600">
          ✅ 자동 모드 활성 — {intervalMin}분마다 배치 실행 중
        </p>
      )}

      {latest && (
        <div className="space-y-2">
          {results.map((result, i) => (
            <div key={i} className="rounded-xl border border-border bg-zinc-50 p-3 dark:bg-zinc-900/30">
              {result.error ? (
                <p className="text-sm font-bold text-rose-600">{result.error}</p>
              ) : (
                <>
                  <p className="text-sm font-bold text-foreground">
                    {result.message}
                    {result.contentTypes && (
                      <span className="ml-2 text-xs font-semibold text-muted-foreground">
                        [{result.contentTypes.join(", ")}]
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    배치: {result.batchSize ?? 0} · 번역: {result.translated ?? 0}
                    · 남은 pending: {result.remainingPending ?? "?"}
                    {result.errors && result.errors.length > 0 && (
                      <span className="text-rose-500"> · 에러: {result.errors.length}건</span>
                    )}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Withdrawal Queue Panel ──────────────────────────────── */

type WithdrawalRequest = {
  id: string;
  user_id: string;
  mom_amount: number;
  rate_at_request: number;
  usd_amount: number;
  spread: number;
  wallet_id: string | null;
  status: string;
  created_at: string;
  profiles: { handle: string | null; display_name: string | null };
};

function WithdrawalQueuePanel() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  async function fetchWithdrawals() {
    try {
      const res = await fetch("/api/admin/withdrawals");
      if (!res.ok) throw new Error("Failed to fetch withdrawals");
      const data = await res.json();
      setRequests(data.withdrawals);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    if (!confirm(`Are you sure you want to mark this as ${status}?`)) return;
    setProcessingId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update");
      }
      await fetchWithdrawals();
    } catch (err) {
      setError(String(err));
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) return <div className="mt-4 h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900/50" />;

  return (
    <div className="mt-4 space-y-4">
      {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
      
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 font-bold text-muted-foreground dark:bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3 text-right">MOM Amount</th>
              <th className="px-4 py-3 text-right">USD Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-medium">
            {requests.map((req) => (
              <tr key={req.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
                <td className="px-4 py-3 tabular-nums">{new Date(req.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  {req.profiles?.display_name || req.profiles?.handle || req.user_id.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {req.mom_amount.toLocaleString()} MOM
                  <br />
                  <span className="text-[10px] text-muted-foreground">Spread: {req.spread * 100}%</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  ${req.usd_amount.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-black uppercase tracking-wider ${
                    req.status === 'queued' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    req.status === 'processing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    req.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}>
                    {req.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {req.status === "queued" && (
                    <button
                      disabled={processingId === req.id}
                      onClick={() => updateStatus(req.id, "processing")}
                      className="text-blue-600 hover:text-blue-800 font-bold disabled:opacity-50"
                    >
                      Process
                    </button>
                  )}
                  {req.status === "processing" && (
                    <button
                      disabled={processingId === req.id}
                      onClick={() => updateStatus(req.id, "completed")}
                      className="text-emerald-600 hover:text-emerald-800 font-bold disabled:opacity-50"
                    >
                      Complete
                    </button>
                  )}
                  {(req.status === "queued" || req.status === "processing") && (
                    <button
                      disabled={processingId === req.id}
                      onClick={() => updateStatus(req.id, "failed")}
                      className="text-rose-600 hover:text-rose-800 font-bold disabled:opacity-50 ml-2"
                    >
                      Fail/Refund
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No withdrawal requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Ad Network Panel ───────────────────────────────────────── */

type AdPlacement = {
  id: string;
  network_name: string;
  unit_name: string;
  unit_type: string;
  position: string;
  script_code: string;
  is_active: boolean;
  priority: number;
  notes: string | null;
  device: string;
  created_at: string;
};

function AdNetworkPanel() {
  const [placements, setPlacements] = useState<AdPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    unit_name: "",
    network_name: "",
    unit_type: "",
    position: "",
    priority: 0,
    notes: "",
    script_code: "",
    device: "all",
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({
    network_name: "adsterra",
    unit_name: "",
    unit_type: "script",
    position: "sidebar_mid",
    script_code: "",
    priority: 0,
    notes: "",
    device: "all",
  });

  useEffect(() => {
    fetchPlacements();
  }, []);

  async function fetchPlacements() {
    try {
      const res = await fetch("/api/admin/ad-placements");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setPlacements(data.placements ?? []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: string, is_active: boolean) {
    setSaving(true);
    await fetch("/api/admin/ad-placements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !is_active }),
    });
    await fetchPlacements();
    setSaving(false);
  }

  function startEdit(p: AdPlacement) {
    setEditingId(p.id);
    setEditForm({
      unit_name: p.unit_name,
      network_name: p.network_name,
      unit_type: p.unit_type,
      position: p.position,
      priority: p.priority,
      notes: p.notes ?? "",
      script_code: p.script_code,
      device: p.device ?? "all",
    });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    await fetch("/api/admin/ad-placements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...editForm }),
    });
    setEditingId(null);
    await fetchPlacements();
    setSaving(false);
  }

  async function deletePlacement(id: string) {
    if (!confirm("이 광고 유닛을 삭제하시겠습니까?")) return;
    setSaving(true);
    await fetch(`/api/admin/ad-placements?id=${id}`, { method: "DELETE" });
    await fetchPlacements();
    setSaving(false);
  }

  async function addPlacement() {
    if (!newForm.unit_name || !newForm.script_code) return;
    setSaving(true);
    await fetch("/api/admin/ad-placements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
    });
    setShowAdd(false);
    setNewForm({
      network_name: "adsterra",
      unit_name: "",
      unit_type: "script",
      position: "sidebar_mid",
      script_code: "",
      priority: 0,
      notes: "",
      device: "all",
    });
    await fetchPlacements();
    setSaving(false);
  }

  /* ── Feed interval config ── */
  const [feedInterval, setFeedInterval] = useState(5);
  const [boardInterval, setBoardInterval] = useState(10);
  const [intervalLoaded, setIntervalLoaded] = useState(false);
  const [intervalSaving, setIntervalSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-config?key=feed_ad_interval")
      .then((r) => r.json())
      .then((d) => {
        if (d.value) {
          setFeedInterval(d.value.feed ?? 5);
          setBoardInterval(d.value.board ?? 10);
        }
        setIntervalLoaded(true);
      })
      .catch(() => setIntervalLoaded(true));
  }, []);

  async function saveInterval() {
    setIntervalSaving(true);
    await fetch("/api/admin/site-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "feed_ad_interval",
        value: { feed: feedInterval, board: boardInterval },
      }),
    });
    setIntervalSaving(false);
  }

  if (loading) return <div className="mt-4 h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900/50" />;

  return (
    <div className="mt-4 space-y-4">
      {error && <p className="text-sm font-bold text-rose-600">{error}</p>}

      {/* ── Feed Ad Interval Config ── */}
      {intervalLoaded && (
        <div className="rounded-xl border border-blue-200/50 bg-blue-50/30 p-4 dark:border-blue-800/30 dark:bg-blue-950/10">
          <h3 className="text-sm font-black text-foreground">📰 피드 광고 간격 설정</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">피드에서 몇 개의 포스트마다 광고를 삽입할지 설정합니다.</p>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="text-[11px] font-bold text-foreground">피드뷰 (카드)</span>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={feedInterval}
                  onChange={(e) => setFeedInterval(Number(e.target.value))}
                  className="h-9 w-20 rounded-lg border border-border bg-white px-2 text-center text-sm font-bold dark:bg-zinc-900"
                />
                <span className="text-[11px] text-muted-foreground">개마다</span>
              </div>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-foreground">보드뷰 (리스트)</span>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={boardInterval}
                  onChange={(e) => setBoardInterval(Number(e.target.value))}
                  className="h-9 w-20 rounded-lg border border-border bg-white px-2 text-center text-sm font-bold dark:bg-zinc-900"
                />
                <span className="text-[11px] text-muted-foreground">개마다</span>
              </div>
            </label>
            <button
              onClick={saveInterval}
              disabled={intervalSaving}
              className="h-9 rounded-full bg-blue-600 px-4 text-xs font-black text-white disabled:opacity-50"
            >
              {intervalSaving ? "저장 중..." : "간격 저장"}
            </button>
          </div>
        </div>
      )}

      {/* Add button */}
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="h-10 rounded-full bg-blue-600 px-5 text-sm font-black text-white transition-colors hover:bg-blue-700"
      >
        {showAdd ? "취소" : "+ 새 광고 유닛 추가"}
      </button>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-xl border border-border bg-zinc-50 p-4 dark:bg-zinc-900/30 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="네트워크">
              <select
                value={newForm.network_name}
                onChange={(e) => setNewForm({ ...newForm, network_name: e.target.value })}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-bold dark:bg-zinc-900"
              >
                <option value="adsterra">Adsterra</option>
                <option value="adsense">AdSense</option>
                <option value="carbon">Carbon Ads</option>
                <option value="other">기타</option>
              </select>
            </Field>
            <Field label="유닛 이름">
              <input
                value={newForm.unit_name}
                onChange={(e) => setNewForm({ ...newForm, unit_name: e.target.value })}
                placeholder="NativeBanner_2"
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-bold dark:bg-zinc-900"
              />
            </Field>
            <Field label="유닛 타입">
              <select
                value={newForm.unit_type}
                onChange={(e) => setNewForm({ ...newForm, unit_type: e.target.value })}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-bold dark:bg-zinc-900"
              >
                <option value="script">Script</option>
                <option value="native_banner">Native Banner</option>
                <option value="banner_728x90">Banner 728×90 (Leaderboard)</option>
                <option value="banner_468x60">Banner 468×60</option>
                <option value="banner_300x250">Banner 300×250 (Medium Rectangle)</option>
                <option value="banner_320x50">Banner 320×50 (Mobile)</option>
                <option value="banner_160x600">Banner 160×600 (Wide Skyscraper)</option>
                <option value="banner_160x300">Banner 160×300</option>
                <option value="popunder">Popunder</option>
                <option value="social_bar">Social Bar</option>
              </select>
            </Field>
            <Field label="위치">
              <select
                value={newForm.position}
                onChange={(e) => setNewForm({ ...newForm, position: e.target.value })}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-bold dark:bg-zinc-900"
              >
                <option value="sidebar_mid">🖥️ 사이드바 중간 (인기토픽 하단)</option>
                <option value="sidebar_bottom">🖥️ 사이드바 하단</option>
                <option value="global">🌐 Global (팝업/플로팅, 전체 페이지)</option>
                <option value="feed_mid">📰 피드 사이 (5번째 포스트 아래)</option>
                <option value="feed_top">📰 피드 최상단</option>
                <option value="feed_bottom">📰 피드 하단</option>
                <option value="post_detail_bottom">📝 포스트 상세 하단</option>
                <option value="attention_top">🎯 어텐션 페이지 상단</option>
                <option value="attention_sidebar">🎯 어텐션 사이드바</option>
              </select>
            </Field>
            <Field label="디바이스">
              <select
                value={newForm.device}
                onChange={(e) => setNewForm({ ...newForm, device: e.target.value })}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-bold dark:bg-zinc-900"
              >
                <option value="all">📱🖥️ 전체 (PC + 모바일)</option>
                <option value="desktop">🖥️ PC만</option>
                <option value="mobile">📱 모바일만</option>
              </select>
            </Field>
            <Field label="우선순위">
              <input
                type="number"
                value={newForm.priority}
                onChange={(e) => setNewForm({ ...newForm, priority: Number(e.target.value) })}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-bold dark:bg-zinc-900"
              />
            </Field>
            <Field label="메모">
              <input
                value={newForm.notes}
                onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm font-bold dark:bg-zinc-900"
              />
            </Field>
          </div>
          <Field label="스크립트 코드 (HTML/JS 전체 붙여넣기)">
            <textarea
              value={newForm.script_code}
              onChange={(e) => setNewForm({ ...newForm, script_code: e.target.value })}
              rows={4}
              placeholder='<script src="https://..."></script>'
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-xs font-mono dark:bg-zinc-900"
            />
          </Field>
          <button
            onClick={addPlacement}
            disabled={saving || !newForm.unit_name || !newForm.script_code}
            className="h-10 rounded-full bg-foreground px-5 text-sm font-black text-background disabled:opacity-50"
          >
            {saving ? "저장 중..." : "추가"}
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {placements.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-zinc-50 p-4 dark:bg-zinc-900/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                    p.is_active
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                  }`}>
                    {p.is_active ? "Active" : "Off"}
                  </span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {p.network_name}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {p.position}
                  </span>
                  {p.device && p.device !== "all" && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      p.device === "mobile"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        : "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
                    }`}>
                      {p.device === "mobile" ? "📱 Mobile" : "🖥️ Desktop"}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-black text-foreground">{p.unit_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Type: {p.unit_type} · Priority: {p.priority} · {p.network_name} {p.unit_type === "native_banner" ? "Native Banner" : p.unit_type} — {p.position} placement
                  {p.notes && ` · ${p.notes}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => toggleActive(p.id, p.is_active)}
                  disabled={saving}
                  className="text-xs font-bold text-blue-600 hover:underline disabled:opacity-50"
                >
                  {p.is_active ? "비활성화" : "활성화"}
                </button>
                <button
                  onClick={() => {
                    if (editingId === p.id) {
                      setEditingId(null);
                    } else {
                      startEdit(p);
                    }
                  }}
                  className="text-xs font-bold text-amber-600 hover:underline"
                >
                  {editingId === p.id ? "닫기" : "수정"}
                </button>
                <button
                  onClick={() => deletePlacement(p.id)}
                  disabled={saving}
                  className="text-xs font-bold text-rose-600 hover:underline disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
            </div>

            {/* Collapsed script preview */}
            {editingId !== p.id && (
              <pre className="mt-2 rounded-lg bg-zinc-100 p-2 text-[10px] text-muted-foreground overflow-x-auto dark:bg-zinc-800/50 max-h-[60px] overflow-hidden">
                {p.script_code}
              </pre>
            )}

            {/* Full edit form */}
            {editingId === p.id && (
              <div className="mt-3 space-y-3 rounded-lg border border-amber-200/60 bg-amber-50/30 p-3 dark:border-amber-800/30 dark:bg-amber-950/10">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="유닛 이름">
                    <input
                      value={editForm.unit_name}
                      onChange={(e) => setEditForm({ ...editForm, unit_name: e.target.value })}
                      className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm font-bold dark:bg-zinc-900"
                    />
                  </Field>
                  <Field label="네트워크">
                    <select
                      value={editForm.network_name}
                      onChange={(e) => setEditForm({ ...editForm, network_name: e.target.value })}
                      className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm font-bold dark:bg-zinc-900"
                    >
                      <option value="adsterra">Adsterra</option>
                      <option value="adsense">AdSense</option>
                      <option value="carbon">Carbon Ads</option>
                      <option value="other">기타</option>
                    </select>
                  </Field>
                  <Field label="유닛 타입">
                    <select
                      value={editForm.unit_type}
                      onChange={(e) => setEditForm({ ...editForm, unit_type: e.target.value })}
                      className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm font-bold dark:bg-zinc-900"
                    >
                      <option value="script">Script</option>
                      <option value="native_banner">Native Banner</option>
                      <option value="banner_728x90">Banner 728×90 (Leaderboard)</option>
                      <option value="banner_468x60">Banner 468×60</option>
                      <option value="banner_300x250">Banner 300×250 (Medium Rectangle)</option>
                      <option value="banner_320x50">Banner 320×50 (Mobile)</option>
                      <option value="banner_160x600">Banner 160×600 (Wide Skyscraper)</option>
                      <option value="banner_160x300">Banner 160×300</option>
                      <option value="popunder">Popunder</option>
                      <option value="social_bar">Social Bar</option>
                    </select>
                  </Field>
                  <Field label="위치">
                    <select
                      value={editForm.position}
                      onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                      className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm font-bold dark:bg-zinc-900"
                    >
                      <option value="sidebar_mid">🖥️ 사이드바 중간</option>
                      <option value="sidebar_bottom">🖥️ 사이드바 하단</option>
                      <option value="global">🌐 Global (팝업/플로팅)</option>
                      <option value="feed_mid">📰 피드 사이 (5번째 포스트)</option>
                      <option value="feed_top">📰 피드 최상단</option>
                      <option value="feed_bottom">📰 피드 하단</option>
                      <option value="post_detail_bottom">📝 포스트 상세 하단</option>
                      <option value="attention_top">🎯 어텐션 상단</option>
                      <option value="attention_sidebar">🎯 어텐션 사이드바</option>
                    </select>
                  </Field>
                  <Field label="디바이스">
                    <select
                      value={editForm.device}
                      onChange={(e) => setEditForm({ ...editForm, device: e.target.value })}
                      className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm font-bold dark:bg-zinc-900"
                    >
                      <option value="all">📱🖥️ 전체</option>
                      <option value="desktop">🖥️ PC만</option>
                      <option value="mobile">📱 모바일만</option>
                    </select>
                  </Field>
                  <Field label="우선순위">
                    <input
                      type="number"
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: Number(e.target.value) })}
                      className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm font-bold dark:bg-zinc-900"
                    />
                  </Field>
                  <Field label="메모">
                    <input
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm font-bold dark:bg-zinc-900"
                    />
                  </Field>
                </div>
                <Field label="스크립트 코드">
                  <textarea
                    value={editForm.script_code}
                    onChange={(e) => setEditForm({ ...editForm, script_code: e.target.value })}
                    rows={4}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-xs font-mono dark:bg-zinc-900"
                  />
                </Field>
                <button
                  onClick={() => saveEdit(p.id)}
                  disabled={saving}
                  className="h-9 rounded-full bg-foreground px-5 text-xs font-black text-background disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "전체 저장"}
                </button>
              </div>
            )}
          </div>
        ))}

        {placements.length === 0 && (
          <p className="text-sm font-semibold text-muted-foreground py-4 text-center">
            등록된 광고 유닛이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
