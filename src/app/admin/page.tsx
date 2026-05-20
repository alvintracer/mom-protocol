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
