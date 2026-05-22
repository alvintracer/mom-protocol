"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  RiAtLine,
  RiExternalLinkLine,
  RiImageLine,
  RiInstagramLine,
  RiLinksLine,
  RiLoginBoxLine,
  RiLogoutBoxRLine,
  RiRedditLine,
  RiSave3Line,
  RiShieldCheckLine,
  RiTelegramLine,
  RiTwitterXLine,
} from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import { useContentTranslations } from "@/shared/hooks/useContentTranslations";
import type { Database, SupportedLanguage } from "@/shared/types/database";

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

type ProfileStats = {
  posts: number;
  attentions: number;
  sources: number;
};

export default function ProfilePage() {
  const { dictionary, languages, setLanguage, t } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats>({
    posts: 0,
    attentions: 0,
    sources: 0,
  });
  const [attentions, setAttentions] = useState<AttentionCluster[]>([]);
  const [recentPosts, setRecentPosts] = useState<PostRow[]>([]);
  const [form, setForm] = useState({
    displayName: "",
    handle: "",
    avatarUrl: "",
    bannerUrl: "",
    bio: "",
    socialLinks: {
      polymarket: "",
      x: "",
      reddit: "",
      instagram: "",
      telegram: "",
    } satisfies SocialLinks,
    preferredLanguage: "ko" as SupportedLanguage,
  });
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
  const [activeTab, setActiveTab] = useState<"edit" | "activity">("edit");

  const postIds = useMemo(() => recentPosts.map((p) => p.id), [recentPosts]);
  const { getPostBody } = useContentTranslations(postIds);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadProfile() {
      setStatus("loading");
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!mounted) {
        return;
      }

      setUserId(user?.id ?? null);
      setEmail(user?.email ?? null);

      if (!user) {
        setProfile(null);
        setStatus("idle");
        return;
      }

      const [
        { data: profileData },
        postCount,
        attentionCount,
        sourceCount,
        { data: attentionRows },
        { data: postRows },
      ] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          countRows("posts", "user_id", user.id),
          countRows("attention_clusters", "created_by", user.id),
          countRows("attention_sources", "imported_by", user.id),
          supabase
            .from("attention_clusters")
            .select("*")
            .eq("created_by", user.id)
            .order("attention_score", { ascending: false })
            .limit(6),
          supabase
            .from("posts")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .limit(6),
        ]);

      if (!mounted) {
        return;
      }

      setProfile(profileData ?? null);
      setStats({
        posts: postCount,
        attentions: attentionCount,
        sources: sourceCount,
      });
      setAttentions(attentionRows ?? []);
      setRecentPosts(postRows ?? []);
      setForm({
        displayName: profileData?.display_name ?? "",
        handle: profileData?.handle ?? "",
        avatarUrl: profileData?.avatar_url ?? "",
        bannerUrl: profileData?.banner_url ?? "",
        bio: profileData?.bio ?? "",
        socialLinks: parseSocialLinks(profileData?.social_links),
        preferredLanguage: profileData?.preferred_language ?? "ko",
      });
      setStatus("idle");
    }

    async function countRows(
      table: "posts" | "attention_clusters" | "attention_sources",
      column: string,
      value: string,
    ) {
      const { count } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq(column, value);

      return count ?? 0;
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: form.displayName.trim() || null,
        handle: form.handle.trim() || null,
        avatar_url: form.avatarUrl.trim() || null,
        banner_url: form.bannerUrl.trim() || null,
        bio: form.bio.trim() || null,
        social_links: normalizeSocialLinks(form.socialLinks),
        preferred_language: form.preferredLanguage,
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      setStatus("error");
      return;
    }

    setProfile(data);
    setLanguage(form.preferredLanguage);
    setStatus("saved");
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUserId(null);
    setEmail(null);
    setProfile(null);
  }

  function updateSocialLink(key: keyof SocialLinks, value: string) {
    setForm((current) => ({
      ...current,
      socialLinks: {
        ...current.socialLinks,
        [key]: value,
      },
    }));
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-lg items-center justify-center p-4">
        <section className="w-full rounded-2xl border border-border bg-background p-6 shadow-sm">
          <div className="flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10">
            <RiLoginBoxLine className="size-6" />
          </div>
          <h1 className="mt-4 text-2xl font-black text-foreground">
            {t(dictionary.profile.signedOutTitle)}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t(dictionary.profile.signedOutDesc)}
          </p>
          <Link
            href="/auth/login?next=/profile"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-black text-white transition-colors hover:bg-blue-700"
          >
            {t(dictionary.actions.signIn)}
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 bg-background pb-20">
      {/* Cover Photo */}
      <div className="h-32 w-full overflow-hidden bg-zinc-100 sm:h-48 dark:bg-zinc-900">
        {profile?.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.banner_url}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full bg-[linear-gradient(135deg,#2563eb_0%,#111827_52%,#f8fafc_100%)]" />
        )}
      </div>

      {/* Profile Header section */}
      <div className="px-4 sm:px-6 max-w-3xl mx-auto">
        <div className="relative flex justify-between items-start">
          {/* Avatar */}
          <div className="-mt-12 sm:-mt-16 p-1 bg-background rounded-full relative">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt=""
                className="size-24 rounded-full border border-border/50 bg-zinc-900 object-cover shadow-md sm:size-32"
              />
            ) : (
              <div className="flex size-24 sm:size-32 items-center justify-center rounded-full bg-zinc-900 text-4xl sm:text-5xl font-black text-white shadow-md border border-border/50">
                {initial(profile?.display_name ?? profile?.handle ?? email)}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-bold text-foreground transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-500/10 dark:hover:border-red-500/30 shadow-sm"
            >
              <RiLogoutBoxRLine className="size-4" />
              {t(dictionary.actions.signOut)}
            </button>
          </div>
        </div>

        {/* Profile Info */}
        <div className="mt-3">
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            {profile?.display_name || (email?.split("@")[0] ?? "User")}
          </h1>
          <p className="text-[15px] font-medium text-muted-foreground mt-0.5">
            @{profile?.handle || "me"}
          </p>
        </div>

        <div className="mt-4 text-[15px] text-foreground leading-snug max-w-2xl">
          {profile?.bio || <span className="text-muted-foreground italic">No bio written yet.</span>}
        </div>

        <SocialLinkRow links={parseSocialLinks(profile?.social_links)} />

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          <div className="flex gap-1.5 items-center">
            <span className="font-bold text-foreground">{(profile?.follower_count ?? 0).toLocaleString()}</span>
            <span className="text-muted-foreground">{t(dictionary.profile.followers)}</span>
          </div>
          <div className="flex gap-1.5 items-center">
            <span className="font-bold text-foreground">{(profile?.following_count ?? 0).toLocaleString()}</span>
            <span className="text-muted-foreground">{t(dictionary.profile.followingLabel)}</span>
          </div>
          <div className="flex gap-1.5 items-center">
            <span className="font-bold text-foreground">{Number(profile?.mom_energy ?? 0).toLocaleString()}</span>
            <span className="text-muted-foreground">MOM</span>
          </div>
          <div className="flex gap-1.5 items-center">
            <span className="font-bold text-foreground">{stats.posts.toLocaleString()}</span>
            <span className="text-muted-foreground">{t(dictionary.profile.myPosts)}</span>
          </div>
          <div className="flex gap-1.5 items-center">
            <span className="font-bold text-foreground">{stats.attentions.toLocaleString()}</span>
            <span className="text-muted-foreground">{t(dictionary.profile.myAttentions)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex w-full border-b border-border max-w-3xl mx-auto px-4 sm:px-6">
        <button
          type="button"
          onClick={() => setActiveTab("edit")}
          className="hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors relative flex items-center justify-center h-12 px-6"
        >
          <span className={`font-bold relative h-full flex items-center ${activeTab === "edit" ? "text-foreground" : "text-muted-foreground"}`}>
            {t(dictionary.profile.title)}
            {activeTab === "edit" ? (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-full" />
            ) : null}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("activity")}
          className="hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors relative flex items-center justify-center h-12 px-6"
        >
          <span className={`font-bold relative h-full flex items-center ${activeTab === "activity" ? "text-foreground" : "text-muted-foreground"}`}>
            Activity
            {activeTab === "activity" ? (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-full" />
            ) : null}
          </span>
        </button>
      </div>

      {activeTab === "activity" ? (
        <div className="mx-auto mt-6 grid max-w-3xl gap-4 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-black text-foreground">Activity</h2>
              <span className="text-xs font-bold text-muted-foreground">u/{profile?.handle || "me"}</span>
            </div>
            <div className="divide-y divide-border">
              {recentPosts.length > 0 ? (
                recentPosts.map((post) => (
                  <article key={post.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-xs font-bold text-blue-500">a/moment</p>
                    <p className="mt-1 line-clamp-3 text-sm font-semibold leading-6 text-foreground">
                      {getPostBody(post.id, post.original_body)}
                    </p>
                    <p className="mt-2 text-xs font-bold text-muted-foreground">
                      {formatDate(post.created_at)} · {post.like_count.toLocaleString()} likes · {post.comment_count.toLocaleString()} comments
                    </p>
                  </article>
                ))
              ) : (
                <p className="py-4 text-sm font-semibold text-muted-foreground">
                  No activity yet.
                </p>
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-border bg-background p-4 shadow-sm">
            <h2 className="text-[15px] font-black text-foreground">a/ Attentions</h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
              {t(dictionary.profile.myAttentions)}
            </p>
            <div className="mt-4 space-y-2">
              {attentions.length > 0 ? (
                attentions.map((attention) => (
                  <Link
                    key={attention.id}
                    href={`/a/${attention.slug || attention.id}`}
                    className="block rounded-xl border border-border p-3 transition-colors hover:border-blue-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <p className="truncate text-sm font-black text-foreground">
                      a/{attention.slug || attention.title.slice(0, 24)}
                    </p>
                    <p className="mt-1 text-xs font-bold text-muted-foreground">
                      {attention.post_count.toLocaleString()} posts · {attention.comment_count.toLocaleString()} comments
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">
                  {t(dictionary.profile.myAttentions)} - 0
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {activeTab === "edit" ? (
      <>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-background p-6 shadow-sm"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t(dictionary.profile.displayName)}>
              <input
                value={form.displayName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900/50 px-4 text-sm font-bold text-foreground outline-none focus:border-blue-500 focus:bg-background transition-colors"
              />
            </Field>
            <Field label={t(dictionary.profile.handle)}>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900/50 px-4 focus-within:border-blue-500 focus-within:bg-background transition-colors">
                <RiAtLine className="size-4 text-muted-foreground" />
                <input
                  value={form.handle}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      handle: event.target.value,
                    }))
                  }
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-foreground outline-none"
                />
              </div>
            </Field>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label={t(dictionary.profile.avatarUrl)}>
              <ImageUpload
                currentUrl={form.avatarUrl}
                userId={userId}
                bucket="avatars"
                onUploaded={(url) => setForm((c) => ({ ...c, avatarUrl: url }))}
                shape="circle"
              />
            </Field>
            <Field label={t(dictionary.profile.bannerUrl)}>
              <ImageUpload
                currentUrl={form.bannerUrl}
                userId={userId}
                bucket="banners"
                onUploaded={(url) => setForm((c) => ({ ...c, bannerUrl: url }))}
                shape="banner"
              />
            </Field>
          </div>

          <div className="mt-5">
            <Field label={t(dictionary.profile.bio)}>
              <textarea
                value={form.bio}
                onChange={(event) =>
                  setForm((current) => ({ ...current, bio: event.target.value }))
                }
                placeholder={t(dictionary.profile.bioPlaceholder)}
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 text-sm font-semibold leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-blue-500 focus:bg-background transition-colors"
              />
            </Field>
          </div>

          <div className="mt-5">
            <Field label={t(dictionary.profile.preferredLanguage)}>
              <select
                value={form.preferredLanguage}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    preferredLanguage: event.target.value as SupportedLanguage,
                  }))
                }
                className="h-11 w-full rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900/50 px-4 text-sm font-bold text-foreground outline-none focus:border-blue-500 focus:bg-background transition-colors appearance-none"
              >
                {languages.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-[13px] font-bold text-muted-foreground">
              {t(dictionary.profile.hotlinks)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t(dictionary.profile.polymarket)}>
                <UrlInput
                  icon={<RiExternalLinkLine className="size-4 text-muted-foreground" />}
                  value={form.socialLinks.polymarket}
                  onChange={(value) => updateSocialLink("polymarket", value)}
                  placeholder="https://polymarket.com/@..."
                />
              </Field>
              <Field label="X">
                <UrlInput
                  icon={<RiTwitterXLine className="size-4 text-muted-foreground" />}
                  value={form.socialLinks.x}
                  onChange={(value) => updateSocialLink("x", value)}
                  placeholder="https://x.com/..."
                />
              </Field>
              <Field label={t(dictionary.profile.reddit)}>
                <UrlInput
                  icon={<RiRedditLine className="size-4 text-muted-foreground" />}
                  value={form.socialLinks.reddit}
                  onChange={(value) => updateSocialLink("reddit", value)}
                  placeholder="https://reddit.com/u/..."
                />
              </Field>
              <Field label={t(dictionary.profile.instagram)}>
                <UrlInput
                  icon={<RiInstagramLine className="size-4 text-muted-foreground" />}
                  value={form.socialLinks.instagram}
                  onChange={(value) => updateSocialLink("instagram", value)}
                  placeholder="https://instagram.com/..."
                />
              </Field>
              <Field label={t(dictionary.profile.telegram)}>
                <UrlInput
                  icon={<RiTelegramLine className="size-4 text-muted-foreground" />}
                  value={form.socialLinks.telegram}
                  onChange={(value) => updateSocialLink("telegram", value)}
                  placeholder="https://t.me/..."
                />
              </Field>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4 pt-5 border-t border-border">
            <button
              type="submit"
              disabled={status === "saving"}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-black text-background transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RiSave3Line className="size-5" />
              {t(dictionary.actions.save)}
            </button>
            {status === "saved" ? (
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <RiShieldCheckLine className="size-4" />
                {t(dictionary.profile.saved)}
              </p>
            ) : null}
            {status === "error" ? (
              <p className="text-sm font-bold text-red-600 flex items-center gap-1.5">
                {t(dictionary.profile.saveFailed)}
              </p>
            ) : null}
          </div>
        </form>
      </div>

      {/* Wallet Section */}
      <WalletSection userId={userId} />

      {/* Buy MOM Section */}
      <BuyMomSection userId={userId} ownedMom={Number(profile?.mom_energy ?? 0)} />

      {/* Change Password Section */}
      <ChangePasswordSection />
      </>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
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

function UrlInput({
  icon,
  value,
  onChange,
  placeholder,
}: {
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-zinc-50 px-4 transition-colors focus-within:border-blue-500 focus-within:bg-background dark:bg-zinc-900/50">
      {icon}
      <input
        type="url"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

const MAX_IMAGE_SIZE = 30 * 1024 * 1024; // 30 MB

function ImageUpload({
  currentUrl,
  userId,
  bucket,
  onUploaded,
  shape = "circle",
}: {
  currentUrl: string;
  userId: string | null;
  bucket: string;
  onUploaded: (url: string) => void;
  shape?: "circle" | "banner";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const displayUrl = preview || currentUrl;

  const handleFile = useCallback(async (file: File) => {
    if (!userId) return;
    setError("");

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Max 30MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Image only");
      return;
    }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const supabase = (await import("@/shared/lib/supabase/client")).createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true });

      if (uploadError) {
        setError("Upload failed");
        setPreview(null);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      onUploaded(urlData.publicUrl);
    } catch {
      setError("Upload failed");
      setPreview(null);
    }
    setUploading(false);
  }, [userId, bucket, onUploaded]);

  const isBanner = shape === "banner";

  return (
    <div>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={`group relative overflow-hidden border-2 border-dashed border-border bg-zinc-50 transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:bg-zinc-900/50 dark:hover:bg-blue-500/5 ${
          isBanner ? "h-24 w-full rounded-xl" : "size-24 rounded-full"
        }`}
      >
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <RiImageLine className="size-5" />
            <span className="text-[10px] font-bold">Click to upload</span>
          </div>
        )}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <div className="size-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
          <RiImageLine className="size-5 text-white" />
        </div>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {error ? (
        <p className="mt-1 text-xs font-bold text-red-500">{error}</p>
      ) : null}
    </div>
  );
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

function normalizeSocialLinks(links: SocialLinks) {
  return Object.fromEntries(
    Object.entries(links)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value),
  );
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

// ─── Wallet Section ─────────────────────────────

type WalletRow = {
  id: string;
  address: string;
  chain_id: number | null;
  wallet_type: "thirdweb_in_app" | "external" | "tookwallet";
  is_primary: boolean;
  label: string | null;
};

const WALLET_TYPE_LABELS: Record<string, string> = {
  thirdweb_in_app: "Thirdweb",
  external: "External",
  tookwallet: "Took (SAR)",
};

function WalletSection({ userId }: { userId: string | null }) {
  const { dictionary, t } = useI18n();
  const p = dictionary.profile;
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newType, setNewType] = useState<"thirdweb_in_app" | "external" | "tookwallet">("external");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    supabase
      .from("wallets")
      .select("id, address, chain_id, wallet_type, is_primary, label")
      .eq("user_id", userId)
      .order("created_at")
      .then(({ data }) => setWallets((data as WalletRow[]) ?? []));
  }, [userId]);

  async function handleAddWallet() {
    if (!userId || !newAddress.trim()) return;
    setSaving(true);
    setNotice(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("wallets")
      .insert({
        user_id: userId,
        address: newAddress.trim(),
        wallet_type: newType,
        is_primary: wallets.length === 0,
      })
      .select("id, address, chain_id, wallet_type, is_primary, label")
      .single();

    if (error) {
      setNotice(error.message);
    } else if (data) {
      setWallets((current) => [...current, data as WalletRow]);
      setNewAddress("");
      setShowForm(false);
      setNotice(t(p.walletAdded));
    }
    setSaving(false);
  }

  async function handleRemoveWallet(walletId: string) {
    const supabase = createClient();
    await supabase.from("wallets").delete().eq("id", walletId);
    setWallets((current) => current.filter((w) => w.id !== walletId));
    setNotice(t(p.walletRemoved));
  }

  if (!userId) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-6">
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-foreground">{t(p.walletSection)}</h2>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-xs font-black text-foreground transition-colors hover:border-blue-500 hover:text-blue-600"
          >
            + {t(p.walletConnect)}
          </button>
        </div>

        {notice && (
          <p className="mt-3 text-sm font-bold text-blue-600">{notice}</p>
        )}

        {wallets.length === 0 && !showForm ? (
          <p className="mt-4 text-sm font-medium text-muted-foreground">{t(p.walletEmpty)}</p>
        ) : (
          <div className="mt-4 space-y-2">
            {wallets.map((w) => (
              <div key={w.id} className="flex items-center gap-3 rounded-xl border border-border bg-zinc-50 p-3 dark:bg-zinc-900/50">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-black text-blue-600">
                  {w.wallet_type === "tookwallet" ? "T" : w.wallet_type === "thirdweb_in_app" ? "3" : "E"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-mono text-xs font-bold text-foreground">
                      {w.address.slice(0, 6)}...{w.address.slice(-4)}
                    </p>
                    {w.is_primary && (
                      <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-black text-blue-600">
                        {t(p.walletPrimary)}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground">
                    {WALLET_TYPE_LABELS[w.wallet_type] ?? w.wallet_type}
                    {w.label ? ` · ${w.label}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveWallet(w.id)}
                  className="text-xs font-bold text-muted-foreground transition-colors hover:text-rose-500"
                >
                  {t(p.walletRemove)}
                </button>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="mt-4 space-y-3 rounded-xl border border-border bg-zinc-50 p-4 dark:bg-zinc-900/50">
            <div>
              <label className="mb-1.5 block text-[12px] font-black text-foreground">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as typeof newType)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-bold text-foreground outline-none appearance-none"
              >
                <option value="thirdweb_in_app">{t(p.walletThirdweb)}</option>
                <option value="external">{t(p.walletExternal)}</option>
                <option value="tookwallet">{t(p.walletTook)}</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-black text-foreground">Address</label>
              <input
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder={t(p.walletAddressPlaceholder)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-blue-500"
              />
            </div>
            <button
              type="button"
              disabled={saving || !newAddress.trim()}
              onClick={handleAddWallet}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {t(p.walletConnect)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Buy MOM Section ────────────────────────────


const PAY_CURRENCIES = ["btc", "eth", "usdt", "usdc", "sol", "matic", "trx", "bnb"];

type PaymentRow = {
  id: string;
  amount_fiat: number;
  fiat_currency: string;
  pay_currency: string | null;
  mom_energy_amount: number;
  status: string;
  created_at: string;
};

type MonthlyContribution = {
  userEnergy: number;
  totalEnergy: number;
  ratio: number;
};

function BuyMomSection({
  userId,
  ownedMom,
}: {
  userId: string | null;
  ownedMom: number;
}) {
  const { dictionary, t } = useI18n();
  const p = dictionary.profile;
  const [amount, setAmount] = useState("5");
  const [payCurrency, setPayCurrency] = useState("");
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [momRate, setMomRate] = useState<number>(0.001);
  const [monthlyContribution, setMonthlyContribution] = useState<MonthlyContribution>({
    userEnergy: 0,
    totalEnergy: 0,
    ratio: 0,
  });

  // Fetch dynamic rate
  useEffect(() => {
    fetch("/api/rate")
      .then((res) => res.json())
      .then((data) => {
        if (data.rate) setMomRate(Number(data.rate));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!userId) return;
    const currentUserId = userId;
    const supabase = createClient();

    async function loadFinancials() {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [paymentsResult, userEnergyResult, totalEnergyResult] = await Promise.all([
        supabase
          .from("payments")
          .select("id, amount_fiat, fiat_currency, pay_currency, mom_energy_amount, status, created_at")
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false })
          .limit(10),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("attention_activity_ledger")
          .select("mom_energy")
          .eq("user_id", currentUserId)
          .gte("created_at", startOfMonth),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("attention_activity_ledger")
          .select("mom_energy")
          .gte("created_at", startOfMonth),
      ]);

      const userEnergy = ((userEnergyResult.data as { mom_energy: number }[] | null) ?? []).reduce(
        (sum, row) => sum + Number(row.mom_energy || 0),
        0,
      );
      const totalEnergy = ((totalEnergyResult.data as { mom_energy: number }[] | null) ?? []).reduce(
        (sum, row) => sum + Number(row.mom_energy || 0),
        0,
      );

      setPayments((paymentsResult.data as PaymentRow[]) ?? []);
      setMonthlyContribution({
        userEnergy,
        totalEnergy,
        ratio: totalEnergy > 0 ? (userEnergy / totalEnergy) * 100 : 0,
      });
    }

    loadFinancials();
  }, [userId]);

  async function handleBuy() {
    if (!userId) return;
    const finalUsd = inputMode === "usd" ? (parseFloat(amount) || 0) : ((parseFloat(momInput) || 0) * momRate);
    if (finalUsd < 1) return;

    setProcessing(true);
    setNotice(null);

    try {
      const res = await fetch("/api/payments/nowpayments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_usd: finalUsd,
          pay_currency: payCurrency || "",
          user_id: userId,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setNotice(data.error || "Payment failed");
        setProcessing(false);
        return;
      }

      // Redirect to NOWPayments invoice page
      if (data.invoice_url) {
        window.open(data.invoice_url, "_blank");
        setNotice(t(p.buyMomSuccess));
      }
    } catch {
      setNotice("Payment failed");
    }
    setProcessing(false);
  }

  const [inputMode, setInputMode] = useState<"usd" | "mom">("usd");
  const [momInput, setMomInput] = useState("5000");

  if (!userId) return null;

  const numAmount = parseFloat(amount) || 0;
  const numMomInput = parseFloat(momInput) || 0;

  // Derived values based on which input is active
  const usdValue = inputMode === "usd" ? numAmount : (numMomInput * momRate);
  const momValue = inputMode === "usd" ? (momRate > 0 ? numAmount / momRate : 0) : numMomInput;

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600",
    confirming: "bg-blue-500/10 text-blue-600",
    confirmed: "bg-blue-500/10 text-blue-600",
    sending: "bg-indigo-500/10 text-indigo-600",
    finished: "bg-emerald-500/10 text-emerald-600",
    failed: "bg-rose-500/10 text-rose-600",
    refunded: "bg-zinc-500/10 text-zinc-600",
    expired: "bg-zinc-500/10 text-zinc-600",
  };

  function handleSwapMode() {
    if (inputMode === "usd") {
      setMomInput(momValue.toFixed(2));
      setInputMode("mom");
    } else {
      setAmount(usdValue.toFixed(2));
      setInputMode("usd");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-6">
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <h2 className="text-lg font-black text-foreground">{t(p.buyMom)}</h2>
        <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">
          {t(p.buyMomDesc)}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MiniStat
            label={t(p.ownedMom)}
            value={`${ownedMom.toLocaleString(undefined, { maximumFractionDigits: 2 })} MOM`}
            accent
          />
          <MiniStat
            label={t(p.expectedVaultShare)}
            value={`≒ $${(ownedMom * momRate).toFixed(2)}`}
          />
          <MiniStat
            label={t(p.buyMomRate)}
            value={`$${momRate.toFixed(4)} / MOM`}
          />
        </div>

        {notice && (
          <p className="mt-3 text-sm font-bold text-blue-600">{notice}</p>
        )}

        {/* Converter */}
        <div className="mt-5 space-y-3">
          {/* Amount input with inline swap */}
          <div>
            <label className="mb-1.5 block text-[12px] font-black text-foreground">
              {inputMode === "usd" ? t(p.buyMomAmount) : "MOM Energy"}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                {inputMode === "usd" ? "$" : "⚡"}
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={inputMode === "usd" ? amount : momInput}
                onChange={(e) => {
                  if (inputMode === "usd") setAmount(e.target.value);
                  else setMomInput(e.target.value);
                }}
                className="h-11 w-full rounded-xl border border-border bg-zinc-50 pl-8 pr-20 text-sm font-bold text-foreground outline-none focus:border-blue-500 dark:bg-zinc-900/50"
              />
              {/* Swap button inside input */}
              <button
                type="button"
                onClick={handleSwapMode}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-bold text-muted-foreground transition-all hover:border-blue-500 hover:text-blue-600 active:scale-95"
                title="Switch input mode"
              >
                <span>⇄</span>
                <span>{inputMode === "usd" ? "MOM" : "USD"}</span>
              </button>
            </div>
            {/* Converted value */}
            <p className="mt-1.5 text-[12px] font-bold text-muted-foreground">
              {inputMode === "usd" ? (
                <>= {momValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} MOM</>
              ) : (
                <>= ${usdValue.toFixed(2)} USD</>
              )}
            </p>
          </div>

          {/* Payment method */}
          <div>
            <label className="mb-1.5 block text-[12px] font-black text-foreground">{t(p.buyMomPayWith)}</label>
            <select
              value={payCurrency}
              onChange={(e) => setPayCurrency(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-zinc-50 px-3 text-sm font-bold text-foreground outline-none appearance-none focus:border-blue-500 dark:bg-zinc-900/50"
            >
              <option value="">Auto (choose on payment page)</option>
              {PAY_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          disabled={processing || usdValue < 1}
          onClick={handleBuy}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-black text-background transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {processing ? t(p.buyMomProcessing) : `${t(p.buyMom)} · ${momValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} MOM`}
        </button>

        {/* Payment History */}
        {payments.length > 0 && (
          <div className="mt-6 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="text-sm font-black text-foreground hover:text-blue-600 transition-colors"
            >
              {t(p.buyMomHistory)} ({payments.length})
            </button>
            {showHistory && (
              <div className="mt-3 space-y-2">
                {payments.map((pay) => (
                  <div key={pay.id} className="flex items-center justify-between rounded-xl border border-border bg-zinc-50 p-3 dark:bg-zinc-900/50">
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        ${pay.amount_fiat} → {pay.mom_energy_amount.toLocaleString()} MOM
                      </p>
                      <p className="text-[10px] font-medium text-muted-foreground">
                        {pay.pay_currency?.toUpperCase() ?? "—"} · {new Date(pay.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${statusColors[pay.status] ?? "bg-zinc-500/10 text-zinc-600"}`}>
                      {pay.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-blue-500/25 bg-blue-50/50 dark:bg-blue-500/10" : "border-border bg-zinc-50 dark:bg-zinc-900/50"}`}>
      <p className="text-[11px] font-black text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-black tabular-nums ${accent ? "text-blue-700 dark:text-blue-300" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function ChangePasswordSection() {
  const { dictionary, t } = useI18n();
  const a = dictionary.auth;
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const rules = [
    { ok: newPw.length >= 8, label: t(a.pwRuleMinLength) },
    { ok: /[a-zA-Z]/.test(newPw), label: t(a.pwRuleLetter) },
    { ok: /\d/.test(newPw), label: t(a.pwRuleNumber) },
  ];
  const allOk = rules.every((r) => r.ok) && newPw === confirmPw && newPw.length > 0;

  async function handleChange() {
    if (!allOk) return;
    setStatus("saving");
    setMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPw });

    if (error) {
      setStatus("error");
      setMsg(t(a.passwordChangeFailed));
    } else {
      setStatus("done");
      setMsg(t(a.passwordChanged));
      setNewPw("");
      setConfirmPw("");
      setTimeout(() => { setStatus("idle"); setMsg(""); }, 3000);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-6">
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <h2 className="text-lg font-black text-foreground">{t(a.changePassword)}</h2>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-black text-foreground">{t(a.newPassword)}</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => { setNewPw(e.target.value); setMsg(""); }}
              placeholder="••••••••"
              className="h-11 w-full rounded-xl border border-border bg-zinc-50 px-4 text-sm font-bold text-foreground outline-none focus:border-blue-500 dark:bg-zinc-900/50"
            />
            {newPw.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {rules.map((r) => (
                  <span
                    key={r.label}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      r.ok
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-zinc-100 text-muted-foreground dark:bg-zinc-800"
                    }`}
                  >
                    {r.ok ? "✓" : "○"} {r.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-black text-foreground">{t(a.confirmNewPassword)}</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => { setConfirmPw(e.target.value); setMsg(""); }}
              placeholder="••••••••"
              className="h-11 w-full rounded-xl border border-border bg-zinc-50 px-4 text-sm font-bold text-foreground outline-none focus:border-blue-500 dark:bg-zinc-900/50"
            />
            {confirmPw.length > 0 && newPw !== confirmPw && (
              <p className="mt-1.5 text-[11px] font-bold text-rose-500">{t(a.passwordMismatch)}</p>
            )}
          </div>
        </div>

        {msg && (
          <p className={`mt-3 text-sm font-bold ${status === "done" ? "text-emerald-600" : "text-rose-600"}`}>
            {msg}
          </p>
        )}

        <button
          type="button"
          disabled={!allOk || status === "saving"}
          onClick={handleChange}
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-black text-background transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "saving" ? "..." : t(a.changePassword)}
        </button>
      </div>
    </div>
  );
}
