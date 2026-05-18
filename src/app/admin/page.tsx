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
