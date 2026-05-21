import {
  AlertCircle,
  FileText,
  FileType2,
  Image as ImageIcon,
  Loader2,
  Lock,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AdminLayout } from "../components/AdminLayout";
import { Button } from "../components/Button";
import { useAuth } from "../contexts/AuthContext";
import {
  deleteDocument,
  listDocuments,
  uploadDocument,
  type DocumentRecord,
} from "../lib/api";

const ROLE_RANK: Record<string, number> = {
  customer: 0,
  staff: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

export function Knowledge() {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = (profile?.role && ROLE_RANK[profile.role] >= 3) ?? false;

  const refresh = useCallback(async () => {
    try {
      const list = await listDocuments();
      setDocs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function uploadFiles(files: FileList | File[]) {
    setError(null);
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        await uploadDocument(f);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Remove this document from Aria's knowledge?")) return;
    setError(null);
    try {
      await deleteDocument(id);
      setDocs((d) => d.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-navy-800">
            Knowledge base
          </h1>
          <p className="mt-1 text-sm text-navy-500">
            Documents you upload here ground Aria's answers about your business.
            PDFs, Word docs, plain text, and images supported.
          </p>
        </div>

        {!canManage && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Lock className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong>Read-only.</strong> Only admins and owners can add or remove
              documents. You can browse the list below.
            </div>
          </div>
        )}

        {canManage && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
            }}
            className={[
              "mb-6 rounded-2xl border-2 border-dashed transition p-8 text-center",
              dragOver
                ? "border-gold-400 bg-gold-50/60"
                : "border-navy-200 bg-white hover:border-gold-400 hover:bg-gold-50/30",
            ].join(" ")}
          >
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-navy-800 ring-1 ring-gold-400/40">
              <Upload className="h-5 w-5 text-gold-400" />
            </div>
            <p className="text-sm font-medium text-navy-800">
              Drop files here, or click to choose
            </p>
            <p className="mt-1 text-xs text-navy-500">
              PDF · DOCX · TXT · MD · CSV · PNG / JPG — up to 25 MB each
            </p>
            <div className="mt-4 flex justify-center">
              <label>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => {
                    if (e.target.files?.length) uploadFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  loading={uploading}
                  leftIcon={<Upload className="h-4 w-4" />}
                  onClick={(e) => {
                    (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
                  }}
                >
                  {uploading ? "Uploading…" : "Choose files"}
                </Button>
              </label>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="break-words">{error}</span>
          </div>
        )}

        <div className="rounded-2xl border border-navy-100 bg-white overflow-hidden shadow-soft">
          <div className="px-5 py-3 border-b border-navy-100 flex items-center justify-between">
            <div className="text-sm font-semibold text-navy-800">
              Documents ({docs.length})
            </div>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-navy-400" />}
          </div>
          {docs.length === 0 && !loading ? (
            <div className="p-10 text-center text-sm text-navy-400">
              No documents yet. {canManage ? "Drop a file above to get started." : ""}
            </div>
          ) : (
            <ul className="divide-y divide-navy-100">
              {docs.map((d) => (
                <DocRow key={d.id} doc={d} canManage={canManage} onDelete={() => onDelete(d.id)} />
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-navy-100 bg-white p-4 text-xs text-navy-500">
          <strong className="text-navy-700">How it works:</strong> Each upload is
          stored in Cloud Storage and indexed into your business's private
          Vertex AI Search Data Store. Aria queries it before every answer and
          cites sources inline.
        </div>
      </div>
    </AdminLayout>
  );
}

function DocRow({
  doc,
  canManage,
  onDelete,
}: {
  doc: DocumentRecord;
  canManage: boolean;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-4 px-5 py-3 hover:bg-navy-50/50 transition">
      <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-navy-100 text-navy-600">
        <FileIcon contentType={doc.content_type} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-navy-800">{doc.filename}</div>
        <div className="text-xs text-navy-500">
          {formatBytes(doc.size_bytes)} · uploaded{" "}
          {new Date(doc.created_at).toLocaleString()}
        </div>
      </div>
      <StatusPill status={doc.status} />
      {canManage && (
        <button
          onClick={onDelete}
          className="grid h-8 w-8 place-items-center rounded-lg text-navy-400 hover:bg-red-50 hover:text-red-600 transition"
          aria-label="Delete document"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

function FileIcon({ contentType }: { contentType: string }) {
  if (contentType.startsWith("image/")) return <ImageIcon className="h-5 w-5" />;
  if (contentType === "application/pdf") return <FileType2 className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function StatusPill({ status }: { status: DocumentRecord["status"] }) {
  const styles: Record<DocumentRecord["status"], string> = {
    uploaded: "bg-navy-100 text-navy-600",
    processing: "bg-sky-100 text-sky-700",
    ready: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
  };
  const labels: Record<DocumentRecord["status"], string> = {
    uploaded: "Stored",
    processing: "Indexing",
    ready: "Ready",
    failed: "Failed",
  };
  return (
    <span
      className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
