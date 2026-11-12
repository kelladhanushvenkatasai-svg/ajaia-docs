
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Plus, FileText, Pencil, Trash2, LogOut, Users
} from "lucide-react";

type Document = {
  id: string;
  title: string;
  updated_at: string;
};

type SharedDocument = {
  permission: "viewer" | "editor";
  documents: Document | null;
};

export default function Dashboard() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sharedDocuments, setSharedDocuments] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDocuments = useCallback(async () => {
    const { data: { user }, error: authError } =
      await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/");
      return;
    }

    setEmail(user.email ?? "");

    const [ownedResult, sharedResult] = await Promise.all([
      supabase
        .from("documents")
        .select("id, title, updated_at")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false }),

      supabase
        .from("document_shares")
        .select("permission, documents(id, title, updated_at)")
        .eq("shared_with", user.id),
    ]);

    if (ownedResult.error) {
      setError(ownedResult.error.message);
      return;
    }

    if (sharedResult.error) {
      setError(sharedResult.error.message);
      return;
    }

    setDocuments(ownedResult.data ?? []);
    setSharedDocuments(
      (sharedResult.data ?? []) as unknown as SharedDocument[]
    );
  }, [supabase, router]);

  useEffect(() => {
    async function initialize() {
      setLoading(true);
      await loadDocuments();
      setLoading(false);
    }

    initialize();
  }, [loadDocuments]);

  async function createDocument() {
    setError("");

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/");
      return;
    }

    const { data, error } = await supabase
      .from("documents")
      .insert({
        title: "Untitled document",
        owner_id: user.id,
        content: {
          type: "doc",
          content: [{ type: "paragraph" }],
        },
      })
      .select("id")
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    router.push(`/documents/${data.id}`);
  }

  async function renameDocument(doc: Document) {
    const newTitle = window.prompt("Enter document name:", doc.title);
    if (!newTitle || !newTitle.trim()) return;

    const { error } = await supabase
      .from("documents")
      .update({
        title: newTitle.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadDocuments();
  }

  async function deleteDocument(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this document?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadDocuments();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  function DocumentCard({
    doc,
    shared = false,
    permission,
  }: {
    doc: Document;
    shared?: boolean;
    permission?: "viewer" | "editor";
  }) {
    return (
      <div className="rounded-xl border bg-white p-5 shadow-sm hover:shadow-md">
        <Link href={`/documents/${doc.id}`} className="block">
          <FileText className="mb-4 text-blue-600" size={30} />
          <h3 className="truncate font-semibold text-slate-800">
            {doc.title}
          </h3>
          <p className="mt-2 text-xs text-slate-400">
            Updated {new Date(doc.updated_at).toLocaleString()}
          </p>
        </Link>

        {shared ? (
          <div className="mt-5 border-t pt-4 text-sm text-slate-600">
            Shared with me · <span className="font-medium capitalize">{permission}</span>
          </div>
        ) : (
          <div className="mt-5 flex gap-3 border-t pt-4">
            <button
              onClick={() => renameDocument(doc)}
              className="flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600"
            >
              <Pencil size={15} /> Rename
            </button>

            <button
              onClick={() => deleteDocument(doc.id)}
              className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-blue-600">CollabSpace</h1>

        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-slate-600 sm:block">{email}</span>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">My Documents</h2>
            <p className="mt-2 text-slate-500">Create and manage your documents.</p>
          </div>

          <button
            onClick={createDocument}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
          >
            <Plus size={18} /> New Document
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-slate-500">Loading documents...</p>
        ) : (
          <>
            {documents.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-white py-16 text-center">
                <FileText className="mx-auto mb-4 text-slate-400" size={42} />
                <h3 className="text-lg font-semibold text-slate-800">No documents yet</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Create your first document to get started.
                </p>
                <button
                  onClick={createDocument}
                  className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700"
                >
                  Create your first document
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {documents.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} />
                ))}
              </div>
            )}

            <div className="mb-5 mt-12">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Users size={23} /> Shared with Me
              </h2>
              <p className="mt-2 text-slate-500">
                Documents other users have shared with you.
              </p>
            </div>

            {sharedDocuments.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-white py-12 text-center">
                <Users className="mx-auto mb-3 text-slate-400" size={36} />
                <p className="text-slate-600">No shared documents yet.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sharedDocuments.map((item) =>
                  item.documents ? (
                    <DocumentCard
                      key={item.documents.id}
                      doc={item.documents}
                      shared
                      permission={item.permission}
                    />
                  ) : null
                )}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
