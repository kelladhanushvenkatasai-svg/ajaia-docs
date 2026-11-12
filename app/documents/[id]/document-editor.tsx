

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { createClient } from "@/lib/supabase/client";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  ArrowLeft,
  Loader2,
  Check,
  Share2,
  FileUp,
} from "lucide-react";

type Props = { id: string };
type SaveStatus = "loading" | "saved" | "saving" | "error";
type Permission = "owner" | "editor" | "viewer";

export default function DocumentEditor({ id }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [error, setError] = useState("");
  const [permission, setPermission] = useState<Permission>("viewer");

  const [showShare, setShowShare] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] =
    useState<"viewer" | "editor">("viewer");
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);
  const canEditRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = permission === "owner" || permission === "editor";
  const canShare = permission === "owner";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        underline: false,
      }),
      Underline,
    ],
    content: "<p></p>",
    immediatelyRender: false,

    onUpdate: ({ editor }) => {
      if (!readyRef.current || !canEditRef.current) return;

      setStatus("saving");
      setError("");

      if (timer.current) clearTimeout(timer.current);

      const content = editor.getJSON();

      timer.current = setTimeout(async () => {
        const { error } = await supabase
          .from("documents")
          .update({
            content,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (error) {
          setError(error.message);
          setStatus("error");
        } else {
          setStatus("saved");
          setError("");
        }

        timer.current = null;
      }, 1000);
    },
  });

  // Load document and determine permissions.
  useEffect(() => {
    let active = true;

    async function loadDocument() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/");
        return;
      }

      const { data, error } = await supabase
        .from("documents")
        .select("title, content, owner_id")
        .eq("id", id)
        .single();

      if (!active) return;

      if (error || !data) {
        setError(error?.message || "Document not found.");
        setStatus("error");
        return;
      }

      const isOwner = data.owner_id === user.id;
      let userPermission: Permission = "viewer";

      if (isOwner) {
        userPermission = "owner";
      } else {
        const { data: share, error: shareError } = await supabase
          .from("document_shares")
          .select("permission")
          .eq("document_id", id)
          .eq("shared_with", user.id)
          .maybeSingle();

        if (!active) return;

        if (shareError || !share) {
          setError("You do not have permission to access this document.");
          setStatus("error");
          return;
        }

        userPermission =
          share.permission === "editor" ? "editor" : "viewer";
      }

      canEditRef.current =
        userPermission === "owner" || userPermission === "editor";

      setPermission(userPermission);
      setTitle(data.title);

      if (editor) {
        editor.commands.setContent(
          data.content || {
            type: "doc",
            content: [{ type: "paragraph" }],
          },
          { emitUpdate: false }
        );

        editor.setEditable(canEditRef.current);
      }

      readyRef.current = true;
      setStatus("saved");
    }

    if (editor) loadDocument();

    return () => {
      active = false;
      readyRef.current = false;

      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [editor, id, router, supabase]);

  // Save document title.
  const saveTitle = useCallback(async () => {
    if (!canEditRef.current) return;

    if (!title.trim()) {
      setError("Document title cannot be empty.");
      return;
    }

    const { error } = await supabase
      .from("documents")
      .update({
        title: title.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setTitle(title.trim());
      setError("");
      setStatus("saved");
    }
  }, [title, id, supabase]);

  // Convert plain text or Markdown into editor HTML.
  function convertToHtml(text: string, isMarkdown: boolean) {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const formatInline = (value: string) =>
      escapeHtml(value)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`(.*?)`/g, "<code>$1</code>");

    if (!isMarkdown) {
      return text
        .split(/\r?\n/)
        .map((line) => line.trim()
          ? `<p>${escapeHtml(line)}</p>`
          : "<p></p>")
        .join("");
    }

    const lines = text.split(/\r?\n/);
    const html: string[] = [];

    let listType: "ul" | "ol" | null = null;

    const closeList = () => {
      if (listType) {
        html.push(`</${listType}>`);
        listType = null;
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        closeList();
        continue;
      }

      if (/^[-*]\s/.test(trimmed)) {
        if (listType !== "ul") {
          closeList();
          html.push("<ul>");
          listType = "ul";
        }

        html.push(`<li>${formatInline(trimmed.slice(2))}</li>`);
        continue;
      }

      if (/^\d+\.\s/.test(trimmed)) {
        if (listType !== "ol") {
          closeList();
          html.push("<ol>");
          listType = "ol";
        }

        html.push(
          `<li>${formatInline(trimmed.replace(/^\d+\.\s/, ""))}</li>`
        );
        continue;
      }

      closeList();

      if (trimmed.startsWith("### ")) {
        html.push(`<h3>${formatInline(trimmed.slice(4))}</h3>`);
      } else if (trimmed.startsWith("## ")) {
        html.push(`<h2>${formatInline(trimmed.slice(3))}</h2>`);
      } else if (trimmed.startsWith("# ")) {
        html.push(`<h1>${formatInline(trimmed.slice(2))}</h1>`);
      } else {
        html.push(`<p>${formatInline(trimmed)}</p>`);
      }
    }

    closeList();

    return html.join("") || "<p></p>";
  }

  // Import TXT or Markdown file.
  async function importFile(file: File) {
    if (!canEditRef.current || !editor) return;

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!["txt", "md"].includes(extension || "")) {
      setError("Only TXT and Markdown files are supported.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("File size must be less than 2 MB.");
      return;
    }

    try {
      const text = await file.text();
      const html = convertToHtml(text, extension === "md");

      editor.commands.setContent(html);
      setError("");
    } catch {
      setError("Unable to import this file.");
    }
  }

  // Share document with another registered user.
  const shareDocument = async () => {
    if (!canShare) {
      setShareMessage("Only the owner can share this document.");
      return;
    }

    if (!shareEmail.trim()) {
      setShareMessage("Please enter the recipient's email.");
      return;
    }

    setSharing(true);
    setShareMessage("");

    const { error } = await supabase.rpc(
      "share_document_with_email",
      {
        p_document_id: id,
        p_email: shareEmail.trim(),
        p_permission: sharePermission,
      }
    );

    setSharing(false);

    if (error) {
      setShareMessage(error.message);
    } else {
      setShareMessage("Document shared successfully!");
      setShareEmail("");
    }
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!editor || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        <Loader2 className="mr-2 animate-spin" size={20} />
        Loading document...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 border-b bg-white px-5 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-lg p-2 hover:bg-slate-100"
              title="Back to documents"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="min-w-0">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                readOnly={!canEdit}
                className="w-full bg-transparent text-2xl font-bold text-slate-900 placeholder:text-slate-400 outline-none read-only:cursor-default"
                placeholder="Untitled document"
              />

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {status === "saving" && (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Saving...
                  </>
                )}

                {status === "saved" && (
                  <>
                    <Check size={12} className="text-green-600" />
                    Saved
                  </>
                )}

                {status === "error" && "Save failed"}

                <span className="rounded-full bg-slate-100 px-2 py-1 capitalize">
                  {permission}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canShare && (
              <button
                onClick={() => setShowShare(!showShare)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Share2 size={16} />
                Share
              </button>
            )}

            <span className="hidden text-sm font-medium text-slate-500 sm:block">
              CollabSpace
            </span>
          </div>
        </div>
      </header>

      {canShare && showShare && (
        <section className="mx-auto mt-5 max-w-5xl rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">
            Share document
          </h2>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              placeholder="Enter user's email address"
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />

            <select
              value={sharePermission}
              onChange={(e) =>
                setSharePermission(e.target.value as "viewer" | "editor")
              }
              className="rounded-lg border px-3 py-2 text-sm text-slate-900"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>

            <button
              onClick={shareDocument}
              disabled={sharing}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {sharing ? "Sharing..." : "Share"}
            </button>
          </div>

          {shareMessage && (
            <p className="mt-3 text-sm text-slate-600">
              {shareMessage}
            </p>
          )}
        </section>
      )}

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-1 border-b bg-slate-50 p-3">
            <ToolbarButton
              label="Bold"
              active={editor.isActive("bold")}
              disabled={!canEdit}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold size={18} />
            </ToolbarButton>

            <ToolbarButton
              label="Italic"
              active={editor.isActive("italic")}
              disabled={!canEdit}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic size={18} />
            </ToolbarButton>

            <ToolbarButton
              label="Underline"
              active={editor.isActive("underline")}
              disabled={!canEdit}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon size={18} />
            </ToolbarButton>

            <div className="mx-2 h-6 border-l" />

            <ToolbarButton
              label="Heading 1"
              active={editor.isActive("heading", { level: 1 })}
              disabled={!canEdit}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
            >
              <Heading1 size={18} />
            </ToolbarButton>

            <ToolbarButton
              label="Heading 2"
              active={editor.isActive("heading", { level: 2 })}
              disabled={!canEdit}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              <Heading2 size={18} />
            </ToolbarButton>

            <div className="mx-2 h-6 border-l" />

            <ToolbarButton
              label="Bulleted list"
              active={editor.isActive("bulletList")}
              disabled={!canEdit}
              onClick={() =>
                editor.chain().focus().toggleBulletList().run()
              }
            >
              <List size={18} />
            </ToolbarButton>

            <ToolbarButton
              label="Numbered list"
              active={editor.isActive("orderedList")}
              disabled={!canEdit}
              onClick={() =>
                editor.chain().focus().toggleOrderedList().run()
              }
            >
              <ListOrdered size={18} />
            </ToolbarButton>

            {canEdit && (
              <>
                <div className="mx-2 h-6 border-l" />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-md p-2 text-sm text-slate-600 hover:bg-slate-200"
                >
                  <FileUp size={18} />
                  Import file
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) importFile(file);
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </div>

          <div className="min-h-[650px] px-6 py-10 sm:px-14">
            <EditorContent editor={editor} />
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <p className="mt-3 text-center text-xs text-slate-400">
          {canEdit
            ? "Your changes are automatically saved to CollabSpace."
            : "You have view-only access to this document."}
        </p>
      </section>

      <style jsx global>{`
        .tiptap {
          min-height: 550px;
          outline: none;
          color: #1e293b;
          font-size: 16px;
          line-height: 1.8;
        }

        .tiptap p {
          margin-bottom: 12px;
        }

        .tiptap h1 {
          font-size: 2rem;
          font-weight: 700;
          margin: 24px 0 12px;
        }

        .tiptap h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 20px 0 10px;
        }

        .tiptap h3 {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .tiptap ul {
          list-style-type: disc;
          padding-left: 28px;
        }

        .tiptap ol {
          list-style-type: decimal;
          padding-left: 28px;
        }

        .tiptap li {
          margin-bottom: 6px;
        }
      `}</style>
    </main>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  label,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md p-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-blue-100 text-blue-700"
          : "text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
