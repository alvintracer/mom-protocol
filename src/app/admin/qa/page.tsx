"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  RiArrowLeftLine,
  RiCheckLine,
  RiClipboardLine,
  RiDeleteBinLine,
  RiImageAddLine,
  RiSendPlaneFill,
  RiFilterLine,
  RiFilterOffLine,
} from "react-icons/ri";

/* ── Types ─── */
type QAItem = {
  id: string;
  body: string;
  images: string[]; // base64 data URLs
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
  resolvedNote?: string;
};

type FilterMode = "all" | "open" | "resolved";

const STORAGE_KEY = "momment.admin.qa_items";

function loadItems(): QAItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveItems(items: QAItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/* ── Component ─── */
export default function QABoardPage() {
  const [items, setItems] = useState<QAItem[]>([]);
  const [body, setBody] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(loadItems());
  }, []);

  const persist = useCallback((next: QAItem[]) => {
    setItems(next);
    saveItems(next);
  }, []);

  /* ── Image handling ─── */
  const addImages = useCallback((files: FileList | File[]) => {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    for (const file of fileArr.slice(0, 5)) {
      const reader = new FileReader();
      reader.onload = () => {
        setPendingImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  /* ── Drag & Drop ─── */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addImages(e.dataTransfer.files);
      }
    },
    [addImages],
  );

  /* ── Paste image ─── */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files = Array.from(e.clipboardData.items)
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter(Boolean) as File[];
      if (files.length > 0) {
        addImages(files);
      }
    },
    [addImages],
  );

  /* ── Submit ─── */
  const handleSubmit = useCallback(() => {
    const trimmed = body.trim();
    if (!trimmed && pendingImages.length === 0) return;

    const newItem: QAItem = {
      id: crypto.randomUUID(),
      body: trimmed,
      images: pendingImages,
      resolved: false,
      createdAt: new Date().toISOString(),
    };

    const next = [...items, newItem];
    persist(next);
    setBody("");
    setPendingImages([]);
    setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [body, pendingImages, items, persist]);

  /* ── Resolve ─── */
  const handleResolve = useCallback(
    (id: string) => {
      const next = items.map((item) =>
        item.id === id
          ? { ...item, resolved: true, resolvedAt: new Date().toISOString(), resolvedNote: resolveNote || undefined }
          : item,
      );
      persist(next);
      setResolveTarget(null);
      setResolveNote("");
    },
    [items, resolveNote, persist],
  );

  const handleUnresolve = useCallback(
    (id: string) => {
      const next = items.map((item) =>
        item.id === id ? { ...item, resolved: false, resolvedAt: undefined, resolvedNote: undefined } : item,
      );
      persist(next);
    },
    [items, persist],
  );

  const handleDelete = useCallback(
    (id: string) => {
      persist(items.filter((item) => item.id !== id));
    },
    [items, persist],
  );

  /* ── Copy unresolved for LLM ─── */
  const copyUnresolved = useCallback(() => {
    const unresolved = items.filter((i) => !i.resolved);
    if (unresolved.length === 0) return;

    const text = unresolved
      .map((item, idx) => {
        let line = `${idx + 1}. ${item.body}`;
        if (item.images.length > 0) {
          line += ` [이미지 ${item.images.length}장 첨부]`;
        }
        return line;
      })
      .join("\n");

    const header = `=== QA 미해결 항목 (${unresolved.length}건) ===\n`;
    navigator.clipboard.writeText(header + text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [items]);

  /* ── Filter ─── */
  const filtered = items.filter((item) => {
    if (filter === "open") return !item.resolved;
    if (filter === "resolved") return item.resolved;
    return true;
  });

  const openCount = items.filter((i) => !i.resolved).length;
  const resolvedCount = items.filter((i) => i.resolved).length;

  return (
    <div
      className="flex min-h-dvh flex-col bg-background"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Header ─── */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/admin"
            className="flex size-8 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <RiArrowLeftLine className="size-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-black">QA 보드</h1>
            <p className="text-xs font-semibold text-muted-foreground">
              {openCount}건 미해결 · {resolvedCount}건 해결
            </p>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            {(["all", "open", "resolved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                  filter === f ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "전체" : f === "open" ? "미해결" : "해결"}
              </button>
            ))}
          </div>

          {/* Copy unresolved */}
          <button
            onClick={copyUnresolved}
            disabled={openCount === 0}
            className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
            title="미해결 항목 텍스트 복사 (LLM 전달용)"
          >
            <RiClipboardLine className="size-3.5" />
            {copied ? "복사됨!" : "미해결 복사"}
          </button>
        </div>
      </header>

      {/* ── Drop overlay ─── */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-600/20 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-blue-400 bg-background/90 px-12 py-8 text-center">
            <RiImageAddLine className="mx-auto size-10 text-blue-500" />
            <p className="mt-2 text-sm font-black text-foreground">이미지를 여기에 놓으세요</p>
          </div>
        </div>
      )}

      {/* ── QA Items List ─── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-4 space-y-3">
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm font-bold text-muted-foreground">
                {filter === "all"
                  ? "QA 항목이 없습니다. 아래에서 추가하세요."
                  : filter === "open"
                    ? "미해결 항목이 없습니다 🎉"
                    : "해결된 항목이 없습니다."}
              </p>
            </div>
          )}

          {filtered.map((item) => (
            <div
              key={item.id}
              className={`group rounded-xl border p-4 transition-all ${
                item.resolved
                  ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-900/10"
                  : "border-border bg-background hover:border-blue-300 dark:hover:border-blue-600/40"
              }`}
            >
              {/* Body */}
              <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-foreground">{item.body}</p>

              {/* Images */}
              {item.images.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.images.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`QA image ${i + 1}`}
                      className="max-h-48 rounded-lg border border-border object-contain"
                    />
                  ))}
                </div>
              )}

              {/* Meta + Actions */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString("ko-KR", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {item.resolved && item.resolvedAt && (
                    <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                      ✓ 해결 (
                      {new Date(item.resolvedAt).toLocaleString("ko-KR", {
                        month: "short",
                        day: "numeric",
                      })}
                      )
                    </span>
                  )}
                </span>

                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {item.resolved ? (
                    <button
                      onClick={() => handleUnresolve(item.id)}
                      className="rounded-md px-2 py-1 text-[11px] font-bold text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                    >
                      다시 열기
                    </button>
                  ) : resolveTarget === item.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="해결 메모 (선택)"
                        value={resolveNote}
                        onChange={(e) => setResolveNote(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleResolve(item.id)}
                        className="h-7 w-40 rounded-md border border-border bg-background px-2 text-[11px]"
                        autoFocus
                      />
                      <button
                        onClick={() => handleResolve(item.id)}
                        className="flex size-7 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <RiCheckLine className="size-3.5" />
                      </button>
                      <button
                        onClick={() => { setResolveTarget(null); setResolveNote(""); }}
                        className="text-[11px] font-bold text-muted-foreground hover:text-foreground px-1"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setResolveTarget(item.id)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                    >
                      <RiCheckLine className="size-3" />
                      해결
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30"
                  >
                    <RiDeleteBinLine className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Resolve note */}
              {item.resolvedNote && (
                <p className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  💬 {item.resolvedNote}
                </p>
              )}
            </div>
          ))}
          <div ref={listEndRef} />
        </div>
      </main>

      {/* ── Composer ─── */}
      <div className="sticky bottom-0 border-t border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {/* Pending images preview */}
          {pendingImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingImages.map((src, i) => (
                <div key={i} className="group/img relative">
                  <img src={src} alt="" className="h-16 rounded-lg border border-border object-contain" />
                  <button
                    onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-rose-600 text-[10px] text-white opacity-0 transition-opacity group-hover/img:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* Image button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
            >
              <RiImageAddLine className="size-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addImages(e.target.files);
                e.target.value = "";
              }}
            />

            {/* Text input */}
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="QA 사항을 입력하세요... (이미지 붙여넣기/드래그 가능)"
              rows={1}
              className="min-h-[40px] max-h-32 flex-1 resize-none rounded-xl border border-border bg-zinc-50 px-4 py-2.5 text-sm font-medium placeholder:text-muted-foreground focus:border-blue-400 focus:outline-none dark:bg-zinc-900"
              style={{ height: "auto", overflow: "hidden" }}
              onInput={(e) => {
                const el = e.target as HTMLTextAreaElement;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 128) + "px";
              }}
            />

            {/* Send */}
            <button
              onClick={handleSubmit}
              disabled={!body.trim() && pendingImages.length === 0}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
            >
              <RiSendPlaneFill className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
