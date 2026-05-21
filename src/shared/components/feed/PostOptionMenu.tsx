"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiDeleteBinLine,
  RiEdit2Line,
  RiEyeOffLine,
  RiMore2Fill,
  RiVolumeMuteLine,
} from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";

type PostMenuProps = {
  postId: string;
  authorId: string;
  currentUserId: string | null;
  /** compact = feed card, full = detail page */
  variant?: "compact" | "full";
  onDeleted?: () => void;
};

export function PostOptionMenu({
  postId,
  authorId,
  currentUserId,
  variant = "compact",
  onDeleted,
}: PostMenuProps) {
  const { dictionary, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const m = dictionary.postMenu;

  const isOwner = currentUserId === authorId;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleDelete = useCallback(async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("posts")
      .update({ is_deleted: true })
      .eq("id", postId)
      .eq("user_id", currentUserId!);

    if (!error) {
      setOpen(false);
      onDeleted?.();
      if (variant === "full") {
        router.push("/");
      }
    }
    setDeleting(false);
  }, [confirming, postId, currentUserId, onDeleted, variant, router]);

  const handleEdit = useCallback(() => {
    setOpen(false);
    router.push(`/posts/${postId}/edit`);
  }, [postId, router]);

  const handleHide = useCallback(() => {
    // Client-side hide: store in localStorage
    const hidden = JSON.parse(localStorage.getItem("momment.hiddenPosts") || "[]");
    if (!hidden.includes(postId)) {
      hidden.push(postId);
      localStorage.setItem("momment.hiddenPosts", JSON.stringify(hidden));
    }
    setOpen(false);
    onDeleted?.(); // reuse callback to remove from feed
  }, [postId, onDeleted]);

  const handleMute = useCallback(() => {
    const muted = JSON.parse(localStorage.getItem("momment.mutedAccounts") || "[]");
    if (!muted.includes(authorId)) {
      muted.push(authorId);
      localStorage.setItem("momment.mutedAccounts", JSON.stringify(muted));
    }
    setOpen(false);
  }, [authorId]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
          setConfirming(false);
        }}
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
      >
        <RiMore2Fill className="size-[18px]" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[200px] overflow-hidden rounded-xl border border-border bg-background shadow-lg"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          {/* Common options */}
          {!isOwner && (
            <>
              <MenuButton icon={<RiEyeOffLine />} label={t(m.hidePost)} onClick={handleHide} />
              <MenuButton icon={<RiVolumeMuteLine />} label={t(m.muteAccount)} onClick={handleMute} />
              <div className="mx-3 border-t border-border" />
            </>
          )}

          {/* Owner options */}
          {isOwner && (
            <>
              <MenuButton icon={<RiEdit2Line />} label={t(m.editPost)} onClick={handleEdit} />
              <div className="mx-3 border-t border-border" />
              {confirming ? (
                <MenuButton
                  icon={<RiDeleteBinLine />}
                  label={deleting ? t(m.deleting) : t(m.confirmDelete)}
                  onClick={handleDelete}
                  danger
                  disabled={deleting}
                />
              ) : (
                <MenuButton
                  icon={<RiDeleteBinLine />}
                  label={t(m.deletePost)}
                  onClick={handleDelete}
                  danger
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-bold transition-colors disabled:opacity-50 ${
        danger
          ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
          : "text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800"
      }`}
    >
      <span className="size-4 shrink-0">{icon}</span>
      {label}
    </button>
  );
}
