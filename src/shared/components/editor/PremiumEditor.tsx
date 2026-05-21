"use client";

import { useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import {
  RiBold,
  RiItalic,
  RiUnderline,
  RiH1,
  RiH2,
  RiH3,
  RiDoubleQuotesL,
  RiSeparator,
  RiImageAddLine,
  RiListUnordered,
  RiListOrdered,
} from "react-icons/ri";

import { createClient } from "@/shared/lib/supabase/client";

type PremiumEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  userId?: string | null;
};

export function PremiumEditor({
  value,
  onChange,
  placeholder = "Write your premium content…",
  userId,
}: PremiumEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Image.configure({
        HTMLAttributes: {
          class: "premium-inline-img",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value || "",
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "premium-prose min-h-[400px] w-full outline-none text-[17px] leading-8 text-foreground",
      },
    },
  });

  const handleImageUpload = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const onFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor || !userId) return;

      // Show placeholder
      const placeholderSrc =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='200'%3E%3Crect fill='%23e5e7eb' width='600' height='200' rx='12'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.35em' fill='%239ca3af' font-size='14' font-family='system-ui'%3EUploading...%3C/text%3E%3C/svg%3E";
      editor.chain().focus().setImage({ src: placeholderSrc }).run();

      try {
        const supabase = createClient();
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${userId}/inline/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("post-media")
          .upload(path, file, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("post-media").getPublicUrl(path);

        // Replace placeholder with real image
        const { state } = editor;
        const { doc } = state;
        let found = false;
        doc.descendants((node, pos) => {
          if (
            !found &&
            node.type.name === "image" &&
            node.attrs.src === placeholderSrc
          ) {
            editor
              .chain()
              .focus()
              .setNodeSelection(pos)
              .setImage({ src: publicUrl })
              .run();
            found = true;
          }
        });
      } catch {
        // Remove placeholder on error
        editor.commands.undo();
      }

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [editor, userId],
  );

  if (!editor) return null;

  return (
    <div className="rounded-2xl border border-border bg-background shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-zinc-50/80 px-2 py-1.5 dark:bg-zinc-900/50">
        <ToolBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <RiBold className="size-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <RiItalic className="size-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <RiUnderline className="size-4" />
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolBtn
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          title="Heading 1"
        >
          <RiH1 className="size-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          title="Heading 2"
        >
          <RiH2 className="size-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          title="Heading 3"
        >
          <RiH3 className="size-4" />
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >
          <RiDoubleQuotesL className="size-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <RiListUnordered className="size-4" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered List"
        >
          <RiListOrdered className="size-4" />
        </ToolBtn>
        <ToolBtn
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Divider"
        >
          <RiSeparator className="size-4" />
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolBtn active={false} onClick={handleImageUpload} title="Insert image">
          <RiImageAddLine className="size-4" />
        </ToolBtn>
      </div>

      {/* Editor area */}
      <div className="px-4 py-4 sm:px-6">
        <EditorContent editor={editor} />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileSelected}
      />
    </div>
  );
}

function ToolBtn({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
        active
          ? "bg-blue-500/15 text-blue-600"
          : "text-muted-foreground hover:bg-zinc-200/60 hover:text-foreground dark:hover:bg-zinc-700/60"
      }`}
    >
      {children}
    </button>
  );
}
