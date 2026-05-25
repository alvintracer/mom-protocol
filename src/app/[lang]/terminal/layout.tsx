"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import type { Database } from "@/shared/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AttentionCluster = Database["public"]["Tables"]["attention_clusters"]["Row"];
type TopicRow = Database["public"]["Tables"]["topics"]["Row"];

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap");

        .crt-shell {
          font-family: "JetBrains Mono", "Courier New", monospace !important;
          background: #08090c;
          color: #e0e2e8;
          min-height: 100vh;
          position: relative;
        }

        .crt-shell * {
          font-family: inherit !important;
        }

        /* scanlines */
        .crt-shell::before {
          content: "";
          position: fixed;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0) 0px,
            rgba(0, 0, 0, 0) 1px,
            rgba(0, 0, 0, 0.04) 1px,
            rgba(0, 0, 0, 0.04) 2px
          );
          pointer-events: none;
          z-index: 50;
        }

        /* vignette */
        .crt-shell::after {
          content: "";
          position: fixed;
          inset: 0;
          background: radial-gradient(
            ellipse at center,
            transparent 65%,
            rgba(0, 0, 0, 0.35) 100%
          );
          pointer-events: none;
          z-index: 50;
        }

        @keyframes crt-flicker {
          0%, 97%, 100% { opacity: 1; }
          98% { opacity: 0.92; }
          99% { opacity: 0.96; }
        }

        .crt-shell {
          animation: crt-flicker 6s infinite;
        }

        /* scrollbar */
        .crt-shell ::-webkit-scrollbar { width: 4px; }
        .crt-shell ::-webkit-scrollbar-track { background: #08090c; }
        .crt-shell ::-webkit-scrollbar-thumb { background: #1e2130; border-radius: 2px; }

        .crt-shell ::selection {
          background: #3b82f6;
          color: #08090c;
        }

        /* ── color tokens ── */
        .t-white { color: #e0e2e8; }
        .t-bright { color: #ffffff; text-shadow: 0 0 6px rgba(255,255,255,0.15); }
        .t-blue { color: #3b82f6; text-shadow: 0 0 5px rgba(59,130,246,0.4); }
        .t-dim { color: #555a6e; text-shadow: none; }
        .t-amber { color: #f59e0b; text-shadow: 0 0 4px rgba(245,158,11,0.3); }
        .t-cyan { color: #22d3ee; text-shadow: 0 0 4px rgba(34,211,238,0.3); }
        .t-red { color: #ef4444; text-shadow: 0 0 3px rgba(239,68,68,0.3); }
        .t-green { color: #22c55e; text-shadow: 0 0 4px rgba(34,197,94,0.3); }
        .t-bg { background: #0c0d12; }
        .t-bg2 { background: #101218; }
        .t-border { border-color: #1e2130; }

        .t-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 500;
          color: #555a6e;
          transition: color 0.15s, background 0.15s;
          border-left: 2px solid transparent;
        }
        .t-nav-item:hover {
          color: #e0e2e8;
          background: rgba(255,255,255,0.03);
          border-left-color: #1e2130;
        }
        .t-nav-active {
          color: #3b82f6 !important;
          text-shadow: 0 0 5px rgba(59,130,246,0.4);
          border-left-color: #3b82f6 !important;
          background: rgba(59,130,246,0.06);
        }

        .t-row:hover {
          background: rgba(255,255,255,0.02);
        }
      `}</style>

      <div className="crt-shell">
        <div className="relative z-[1] flex min-h-screen">
          <TerminalLeftSidebar />
          <main className="flex-1 min-w-0 border-l border-r t-border">
            {children}
          </main>
          <TerminalRightSidebar />
        </div>
      </div>
    </>
  );
}

// ─── Left Sidebar ───────────────────────────────

function TerminalLeftSidebar() {
  const { dictionary, language, setLanguage, t } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [momRate, setMomRate] = useState(0.001);
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-GB"));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    async function loadProfile() {
      const { data: userData } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!userData.user) { setProfile(null); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", userData.user.id).maybeSingle();
      if (mounted) setProfile(data ?? null);
    }
    loadProfile();
    fetch("/api/rate").then((r) => r.json()).then((d) => { if (mounted && d.rate) setMomRate(Number(d.rate)); }).catch(() => {});
    const { data: listener } = supabase.auth.onAuthStateChange(() => { loadProfile(); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setProfile(null);
  }

  const navItems = [
    { href: "/", label: t(dictionary.nav.home), cmd: "home" },
    { href: "/explore", label: t(dictionary.nav.explore), cmd: "explore" },
    { href: "/terminal", label: t(dictionary.nav.oracle), cmd: "oracle", active: true },
    { href: "/rewards", label: t(dictionary.nav.rewards), cmd: "vault" },
    { href: "/notifications", label: t(dictionary.nav.notifications), cmd: "notif" },
    { href: "/messages", label: t(dictionary.nav.messages), cmd: "msg" },
    { href: "/bookmarks", label: t(dictionary.nav.bookmarks), cmd: "saved" },
    { href: "/profile", label: t(dictionary.nav.profile), cmd: "me" },
  ];

  return (
    <aside className="hidden w-[200px] shrink-0 lg:flex lg:flex-col lg:justify-between py-4 px-2 sticky top-0 h-screen overflow-y-auto">
      <div>
        <Link href="/" className="block px-3 mb-5">
          <span className="t-bright text-[14px] font-bold">momment<span className="t-dim">.</span></span>
          <div className="text-[8px] t-dim mt-0.5">terminal v0.1</div>
        </Link>
        <div className="px-3 mb-4 text-[9px] t-dim">SYS {clock}</div>
        <nav>
          {navItems.map((item) => (
            <Link key={item.cmd} href={item.href} className={`t-nav-item ${item.active ? "t-nav-active" : ""}`}>
              <span className="t-dim w-[6ch] shrink-0 text-[9px]">/{item.cmd}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          <Link href="/advertise" className="t-nav-item">
            <span className="t-dim w-[6ch] shrink-0 text-[9px]">/ads</span>
            <span>{t(dictionary.nav.advertise)}</span>
          </Link>
        </nav>

        {/* View Mode Toggle */}
        <div className="mt-5 px-2">
          <div className="text-[8px] t-dim uppercase tracking-widest mb-1.5 px-1">VIEW MODE</div>
          <div className="flex border t-border overflow-hidden">
            <span className="flex-1 text-center py-1.5 text-[10px] font-bold t-blue t-bg2" style={{ borderRight: "1px solid #1e2130", background: "rgba(59,130,246,0.08)" }}>
              terminal
            </span>
            <Link href="/oracle/standard" className="flex-1 text-center py-1.5 text-[10px] font-bold t-dim hover:t-white transition-colors">
              standard
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* Language */}
        <div className="px-2">
          <div className="text-[8px] t-dim uppercase tracking-widest mb-1.5 px-1">LANG</div>
          <div className="flex border t-border overflow-hidden">
            {(["ko", "en", "es"] as const).map((code) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                className={`flex-1 text-center py-1.5 text-[10px] font-bold transition-colors ${
                  language === code
                    ? "t-blue"
                    : "t-dim hover:t-white"
                }`}
                style={language === code ? { background: "rgba(59,130,246,0.08)" } : undefined}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* MOM Energy Card */}
        {profile ? (
        <Link href="/profile" className="block border t-border p-2.5 transition-colors t-row">
          <div className="flex items-center justify-between">
            <div className="text-[8px] t-dim uppercase tracking-widest">{t(dictionary.sidebar.myEnergy)}</div>
            <span className="text-[8px] font-bold t-blue">{t(dictionary.sidebar.topUp)}</span>
          </div>
          <div className="text-[16px] font-bold t-bright mt-1 tabular-nums">
            {profile ? Number(profile.mom_energy).toLocaleString() : "---"}
            <span className="ml-1 text-[10px] t-dim">MOM</span>
          </div>
          <div className="mt-1.5 h-px" style={{ background: "#1e2130" }} />
          <div className="flex gap-3 mt-1.5 text-[9px]">
            <div>
              <span className="t-dim">{t(dictionary.sidebar.totalAssets)} </span>
              <span className="t-amber tabular-nums">${profile ? (Number(profile.mom_energy) * momRate).toFixed(2) : "0.00"}</span>
            </div>
            <div>
              <span className="t-dim">{t(dictionary.sidebar.rate)} </span>
              <span className="t-blue tabular-nums">${momRate.toFixed(4)}</span>
            </div>
          </div>
        </Link>
        ) : null}

        {/* Profile + Sign Out */}
        <div className="border t-border p-2.5">
          <div className="flex items-center gap-2">
            <Link href={profile ? "/profile" : "/auth/login"} className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-5 h-5 border t-border flex items-center justify-center text-[9px] t-blue shrink-0">
                {profile ? (profile.display_name ?? profile.handle ?? "?").charAt(0).toUpperCase() : ">"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] t-bright truncate">
                  {profile?.display_name ?? profile?.handle ?? t(dictionary.actions.signIn)}
                </div>
                <div className="text-[8px] t-dim truncate">
                  {profile ? `@${profile.handle ?? "user"} · ${Number(profile.mom_energy).toLocaleString()} MOM` : t(dictionary.profile.signedOutTitle)}
                </div>
              </div>
            </Link>
            {profile && (
              <button
                onClick={handleSignOut}
                className="text-[8px] t-dim hover:t-red transition-colors shrink-0"
                title={t(dictionary.actions.signOut)}
              >
                [exit]
              </button>
            )}
          </div>
        </div>
        <div className="text-[7px] t-dim px-1">giwa-sepolia · AIO/v0.1</div>
      </div>
    </aside>
  );
}

// ─── Right Sidebar ──────────────────────────────

function TerminalRightSidebar() {
  const { dictionary, language, t } = useI18n();
  const [attentions, setAttentions] = useState<AttentionCluster[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [leaders, setLeaders] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    async function load() {
      const [attRes, topicRes, leaderRes] = await Promise.all([
        supabase.from("attention_clusters").select("*").in("status", ["active", "reviewing"]).order("attention_score", { ascending: false }).limit(5),
        supabase.from("topics").select("*").order("created_at", { ascending: false }).limit(8),
        supabase.from("profiles").select("*").order("mom_energy", { ascending: false }).limit(4),
      ]);
      if (!mounted) return;
      setAttentions(attRes.data ?? []);
      setTopics(topicRes.data ?? []);
      setLeaders(leaderRes.data ?? []);
    }
    load();
    return () => { mounted = false; };
  }, [language]);

  return (
    <aside className="hidden xl:flex xl:flex-col w-[280px] shrink-0 sticky top-0 h-screen overflow-y-auto py-4 px-3 gap-4">
      {/* Search */}
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] t-dim">$</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search..."
          className="w-full t-bg2 border t-border text-[11px] t-white placeholder:t-dim py-2 pl-7 pr-3 outline-none focus:border-[#3b82f6] transition-colors"
          style={{ fontFamily: "inherit", background: "#0c0d12", color: "#e0e2e8" }}
        />
      </div>

      {/* Today's Attention */}
      <div className="border t-border">
        <div className="px-3 py-2 border-b t-border t-bg">
          <span className="text-[10px] t-dim">$ </span>
          <span className="text-[10px] t-bright">attention.trending</span>
        </div>
        {attentions.length === 0 ? (
          <div className="px-3 py-4 text-[10px] t-dim">No data.</div>
        ) : (
          attentions.map((a, i) => (
            <Link
              key={a.id}
              href={`/a/${a.slug || a.id}`}
              className="block px-3 py-2 t-row border-b t-border last:border-0 transition-colors"
            >
              <div className="flex items-center gap-2 text-[9px]">
                <span className="t-dim">#{i + 1}</span>
                <span className="t-dim">{a.category ?? "general"}</span>
                <span className="ml-auto t-blue tabular-nums font-bold">{a.attention_score.toLocaleString()}</span>
              </div>
              <p className="text-[11px] t-white mt-0.5 leading-tight line-clamp-2">{a.title}</p>
              <div className="text-[9px] t-dim mt-0.5">{a.post_count} posts · {a.source_count} sources</div>
            </Link>
          ))
        )}
      </div>

      {/* Topics */}
      <div className="border t-border">
        <div className="px-3 py-2 border-b t-border t-bg">
          <span className="text-[10px] t-dim">$ </span>
          <span className="text-[10px] t-bright">topics.hot</span>
        </div>
        <div className="px-3 py-2 flex flex-wrap gap-1.5">
          {topics.map((tp) => (
            <Link
              key={tp.id}
              href={`/topic/${tp.slug}`}
              className="inline-flex text-[10px] t-dim border t-border px-2 py-0.5 transition-colors hover:t-blue hover:border-[#3b82f6]"
            >
              #{tp.canonical_label}
            </Link>
          ))}
          {topics.length === 0 && <span className="text-[10px] t-dim">No topics.</span>}
        </div>
      </div>

      {/* Leaders */}
      {leaders.length > 0 && (
        <div className="border t-border">
          <div className="px-3 py-2 border-b t-border t-bg">
            <span className="text-[10px] t-dim">$ </span>
            <span className="text-[10px] t-bright">users.top</span>
          </div>
          {leaders.map((u, i) => (
            <Link
              key={u.id}
              href={`/u/${u.handle ?? u.id}`}
              className="flex items-center gap-2 px-3 py-2 t-row border-b t-border last:border-0 transition-colors"
            >
              <span className="text-[9px] t-dim w-3">{i + 1}</span>
              <div className="w-4 h-4 border t-border flex items-center justify-center text-[8px] t-blue shrink-0">
                {(u.display_name ?? u.handle ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] t-white truncate">{u.display_name || u.handle}</div>
              </div>
              <span className="text-[9px] t-amber tabular-nums font-bold shrink-0">{Number(u.mom_energy).toLocaleString()}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-[8px] t-dim px-1 mt-auto space-y-0.5">
        <div className="h-px" style={{ background: "#1e2130" }} />
        <div className="flex flex-wrap gap-x-2 pt-1">
          <Link href="/economy" className="t-blue hover:underline">{t(dictionary.sidebar.economyDocs ?? { ko: "이코노미", en: "Economy", es: "Economía" })}</Link>
          <a href="/terms" className="hover:underline">{t(dictionary.footer.terms)}</a>
          <a href="/privacy" className="hover:underline">{t(dictionary.footer.privacy)}</a>
        </div>
        <span>© 2026 momment.</span>
      </div>
    </aside>
  );
}
