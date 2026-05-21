"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import {
  RiExternalLinkLine,
  RiInstagramLine,
  RiLinksLine,
  RiMailLine,
  RiRedditLine,
  RiTelegramLine,
  RiTwitterXLine,
  RiUserFollowLine,
} from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";

import { createClient } from "@/shared/lib/supabase/client";
import { useContentTranslations } from "@/shared/hooks/useContentTranslations";
import type { Database } from "@/shared/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AttentionCluster = Database["public"]["Tables"]["attention_clusters"]["Row"];
type PostRow = Database["public"]["Tables"]["posts"]["Row"];
type SocialLinks = {
  polymarket: string;
  x: string;
  reddit: string;
  instagram: string;
  telegram: string;
};

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attentions, setAttentions] = useState<AttentionCluster[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading",
  );
  const { dictionary, t } = useI18n();

  const postIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const { getPostBody } = useContentTranslations(postIds);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadProfile() {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("handle", handle)
        .maybeSingle();

      if (!mounted) {
        return;
      }

      if (!profileData) {
        setStatus("missing");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const currentId = userData.user?.id ?? null;

      const [{ data: attentionRows }, { data: postRows }, followResult] = await Promise.all([
        supabase
          .from("attention_clusters")
          .select("*")
          .eq("created_by", profileData.id)
          .order("attention_score", { ascending: false })
          .limit(8),
        supabase
          .from("posts")
          .select("*")
          .eq("user_id", profileData.id)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(8),
        currentId
          ? supabase
              .from("user_follows")
              .select("id")
              .eq("follower_id", currentId)
              .eq("following_id", profileData.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (!mounted) {
        return;
      }

      setCurrentUserId(currentId);
      setProfile(profileData);
      setAttentions(attentionRows ?? []);
      setPosts(postRows ?? []);
      setIsFollowing(Boolean(followResult.data));
      setFollowerCount(profileData.follower_count ?? 0);
      setStatus("ready");
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [handle]);

  const handleToggleFollow = useCallback(async () => {
    if (!profile) return;
    if (!currentUserId) {
      window.location.href = `/auth/login?next=/u/${handle}`;
      return;
    }

    setIsTogglingFollow(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("toggle_user_follow", {
      target_user_id: profile.id,
    });
    setIsTogglingFollow(false);

    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    setIsFollowing(data.followed === true);
    if (typeof data.follower_count === "number") {
      setFollowerCount(data.follower_count);
    }
  }, [profile, currentUserId, handle]);

  const isOwnProfile = currentUserId === profile?.id;

  if (status === "missing") {
    notFound();
  }

  if (status === "loading" || !profile) {
    return (
      <div className="p-6 text-sm font-bold text-muted-foreground">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="h-32 w-full overflow-hidden bg-zinc-100 sm:h-48 dark:bg-zinc-900">
        {profile.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.banner_url} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-[linear-gradient(135deg,#2563eb_0%,#0f172a_55%,#334155_100%)]" />
        )}
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="-mt-12 inline-flex rounded-full bg-background p-1 sm:-mt-16">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="size-24 rounded-full border border-border/50 object-cover shadow-md sm:size-32"
            />
          ) : (
            <div className="flex size-24 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br from-zinc-800 to-zinc-950 text-4xl font-black text-white shadow-lg sm:size-32 sm:text-5xl">
              {initial(profile.display_name ?? profile.handle)}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              {profile.display_name || profile.handle}
            </h1>
            <p className="mt-0.5 text-[15px] font-medium text-muted-foreground">
              u/{profile.handle}
            </p>
          </div>
          {!isOwnProfile ? (
            <div className="flex items-center gap-2">
              <MessageButton
                targetUserId={profile.id}
                targetDisplayName={profile.display_name}
                currentUserId={currentUserId}
              />
              <button
                onClick={handleToggleFollow}
                disabled={isTogglingFollow}
                className={`inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-black transition-colors disabled:opacity-50 ${
                  isFollowing
                    ? "border border-border bg-background text-foreground hover:border-red-300 hover:text-red-500"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {isFollowing ? (
                  <>{t(dictionary.actions.following)}</>
                ) : (
                  <><RiUserFollowLine className="size-4" />{t(dictionary.actions.follow)}</>
                )}
              </button>
            </div>
          ) : null}
        </div>
          <p className="mt-4 max-w-2xl text-[15px] leading-snug text-foreground">
            {profile.bio || t(dictionary.profile.noBio ?? "No bio written yet.")}
          </p>
          <SocialLinkRow links={parseSocialLinks(profile.social_links)} />

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          <ProfileStat value={followerCount.toLocaleString()} label={t(dictionary.profile.followers ?? "Followers")} />
          <ProfileStat value={(profile.following_count ?? 0).toLocaleString()} label={t(dictionary.profile.followingLabel ?? "Following")} />
          <ProfileStat value={Number(profile.mom_energy).toLocaleString()} label="MOM" accent />
        </div>
      </div>

      <div className="mx-auto mt-6 grid max-w-3xl gap-5 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-[15px] font-black text-foreground">Activity</h2>
          </div>
          <div className="divide-y divide-border">
            {posts.length > 0 ? (
              posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="block px-5 py-3.5 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30"
                >
                  <p className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">a/moment</p>
                  <p className="mt-1.5 line-clamp-3 text-sm font-medium leading-6 text-foreground">
                    {getPostBody(post.id, post.original_body)}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[12px] font-medium text-muted-foreground">
                    <span>{formatDate(post.created_at)}</span>
                    <span className="size-0.5 rounded-full bg-muted-foreground" />
                    <span>{post.like_count.toLocaleString()} likes</span>
                    <span className="size-0.5 rounded-full bg-muted-foreground" />
                    <span>{post.comment_count.toLocaleString()} comments</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="px-5 py-6 text-sm font-medium text-muted-foreground">
                No activity yet.
              </p>
            )}
          </div>
        </section>

        <aside className="overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm self-start">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-[15px] font-black text-foreground">a/ Attentions</h2>
          </div>
          <div className="p-3 space-y-2">
            {attentions.length > 0 ? (
              attentions.map((attention) => (
                <Link
                  key={attention.id}
                  href={`/a/${attention.slug || attention.id}`}
                  className="block rounded-xl border border-border/60 bg-zinc-50/50 dark:bg-zinc-900/20 p-3 transition-all hover:border-blue-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                >
                  <p className="truncate text-[13px] font-black text-foreground">
                    a/{attention.slug || attention.title.slice(0, 24)}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                    {attention.post_count.toLocaleString()} posts · {attention.comment_count.toLocaleString()} comments
                  </p>
                </Link>
              ))
            ) : (
              <p className="px-1 py-3 text-sm font-medium text-muted-foreground">
                No attentions yet.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProfileStat({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`tabular-nums font-bold ${accent ? "text-blue-600 dark:text-blue-400" : "text-foreground"}`}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function initial(value?: string | null) {
  return value?.trim().slice(0, 1).toUpperCase() || "m";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function parseSocialLinks(value: Profile["social_links"] | null | undefined): SocialLinks {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return {
    polymarket: typeof source.polymarket === "string" ? source.polymarket : "",
    x: typeof source.x === "string" ? source.x : "",
    reddit: typeof source.reddit === "string" ? source.reddit : "",
    instagram: typeof source.instagram === "string" ? source.instagram : "",
    telegram: typeof source.telegram === "string" ? source.telegram : "",
  };
}

function SocialLinkRow({ links }: { links: SocialLinks }) {
  const items = [
    { key: "polymarket", href: links.polymarket, icon: RiExternalLinkLine },
    { key: "x", href: links.x, icon: RiTwitterXLine },
    { key: "reddit", href: links.reddit, icon: RiRedditLine },
    { key: "instagram", href: links.instagram, icon: RiInstagramLine },
    { key: "telegram", href: links.telegram, icon: RiTelegramLine },
  ].filter((item) => item.href);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <RiLinksLine className="size-4 text-muted-foreground" />
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <a
            key={item.key}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-blue-500 hover:text-blue-600"
          >
            <Icon className="size-4" />
          </a>
        );
      })}
    </div>
  );
}

function MessageButton({
  targetUserId,
  targetDisplayName,
  currentUserId,
}: {
  targetUserId: string;
  targetDisplayName: string | null;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { dictionary, t } = useI18n();

  const handleClick = useCallback(async () => {
    if (!currentUserId) {
      router.push("/auth");
      return;
    }
    setLoading(true);
    const supabase = createClient();

    // Check for existing conversation
    const { data: myConvs } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", currentUserId);

    const myConvIds = (myConvs ?? []).map((r) => r.conversation_id);

    if (myConvIds.length > 0) {
      const { data: sharedConv } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", targetUserId)
        .in("conversation_id", myConvIds)
        .limit(1);

      if (sharedConv && sharedConv.length > 0) {
        router.push(`/messages?conv=${sharedConv[0].conversation_id}`);
        setLoading(false);
        return;
      }
    }

    // Generate ID client-side to avoid RLS SELECT chicken-and-egg issue
    const convId = crypto.randomUUID();

    await supabase
      .from("conversations")
      .insert({ id: convId });

    await supabase
      .from("conversation_members")
      .insert([
        { conversation_id: convId, user_id: currentUserId },
        { conversation_id: convId, user_id: targetUserId },
      ]);

    router.push(`/messages?conv=${convId}`);
    setLoading(false);
  }, [currentUserId, targetUserId, router]);

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-blue-500 hover:text-blue-600 disabled:opacity-50"
      title={t(dictionary.messagesPage.title)}
    >
      <RiMailLine className="size-4" />
    </button>
  );
}
