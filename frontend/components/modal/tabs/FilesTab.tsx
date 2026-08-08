'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, type Objective, type KeyResult, type Attachment, type AttachmentDeletionAudit } from '@/lib/api';
import { FileText, File, Upload, Trash2, Download, Loader2, History } from 'lucide-react';
import { toast } from 'sonner';
import { useFocusTrap, useRestoreFocusWhenActive } from '@/lib/useFocusTrap';

interface FilesTabProps {
  objective: Objective;
  keyResults: KeyResult[];
  readOnly?: boolean;
}

/** Mirrors backend limits (see okrs.py). */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'csv',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
]);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isImageType(type: string): boolean {
  return type.startsWith('image/');
}

function isPdfType(type: string): boolean {
  return type === 'application/pdf';
}

function isOfficeDocType(type: string, fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (/\.(docx?|xlsx?|pptx?)$/i.test(lower)) return true;
  return (
    type.includes('wordprocessingml') ||
    type.includes('spreadsheetml') ||
    type.includes('presentationml') ||
    type === 'application/msword' ||
    type === 'application/vnd.ms-excel' ||
    type === 'application/vnd.ms-powerpoint'
  );
}

function extensionLabel(fileName: string): string {
  const m = fileName.match(/\.([^.]+)$/);
  return (m?.[1] ?? '?').slice(0, 4).toUpperCase();
}

/** Seed / legacy rows used "#" or non-HTTP URLs; real uploads use http(s) from storage. */
export function isPlaceholderAttachmentUrl(url: string | undefined): boolean {
  const u = (url ?? '').trim();
  return u === '' || u === '#' || u === '/#' || !/^https?:\/\//i.test(u);
}

function validateClientFile(file: File): string | null {
  if (file.size <= 0) return `${file.name}: file is empty`;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `${file.name}: exceeds ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB`;
  }
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return `${file.name}: type not allowed (PDF, images, Office, CSV, TXT)`;
  }
  return null;
}

function officeViewerUrl(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

function displayUserId(id: string | undefined): string {
  if (!id) return '—';
  if (id.includes('|')) return id.split('|').pop() ?? id;
  return id;
}

export function FilesTab({ objective, keyResults, readOnly }: FilesTabProps) {
  const objectiveId = objective._id;
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [deletionLog, setDeletionLog] = useState<AttachmentDeletionAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedKrId, setSelectedKrId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [previewResolved, setPreviewResolved] = useState<{
    url: string;
    fileName: string;
    fileType: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewPanelRef = useRef<HTMLDivElement>(null);
  const fileInputId = 'okr-file-upload-input';

  useRestoreFocusWhenActive(!!preview);
  useFocusTrap(previewPanelRef, !!preview);

  const load = useCallback(async () => {
    if (!objectiveId) return;
    setLoading(true);
    try {
      const list = await api.getAttachments(objectiveId);
      setAttachments(list);
    } catch (e) {
      console.error(e);
      toast.error('Could not load attachments');
    } finally {
      setLoading(false);
    }
  }, [objectiveId]);

  const loadAudit = useCallback(async () => {
    if (!objectiveId) return;
    setAuditLoading(true);
    try {
      const rows = await api.getAttachmentDeletions(objectiveId);
      setDeletionLog(rows);
    } catch {
      setDeletionLog([]);
    } finally {
      setAuditLoading(false);
    }
  }, [objectiveId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  useEffect(() => {
    if (!preview?._id) {
      setPreviewResolved(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewResolved(null);
    api
      .getAttachmentAccess(preview._id)
      .then((data) => {
        if (!cancelled) setPreviewResolved(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not open file (access denied or network error)');
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview?._id]);

  const processFileList = async (files: FileList | null) => {
    if (!objectiveId || !files?.length || readOnly || uploading) return;
    const arr = Array.from(files);
    const errors: string[] = [];
    const ok: File[] = [];
    for (const f of arr) {
      const err = validateClientFile(f);
      if (err) errors.push(err);
      else ok.push(f);
    }
    setUploadErrors(errors);
    if (errors.length) {
      toast.error(`${errors.length} file(s) skipped`, { description: errors.slice(0, 3).join('\n') });
    }
    if (!ok.length) return;

    setUploading(true);
    try {
      for (const file of ok) {
        await api.createAttachment({
          objectiveId,
          keyResultId: selectedKrId || undefined,
          file,
        });
      }
      await load();
      await loadAudit();
      if (ok.length) toast.success(ok.length === 1 ? 'File uploaded' : `${ok.length} files uploaded`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFileList(e.dataTransfer.files);
  };

  const handleDelete = async (id: string) => {
    if (readOnly) return;
    try {
      await api.deleteAttachment(id);
      await load();
      await loadAudit();
      if (preview?._id === id) setPreview(null);
      toast.success('File removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const openDownload = async (id: string) => {
    try {
      const { url, fileName } = await api.getAttachmentAccess(id);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error('Could not start download');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <p className="text-sm text-muted-foreground">
            Attach files to this objective or to a specific key result. Max {MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB per
            file. Types: PDF, images, Word, Excel, PowerPoint, CSV, TXT.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!readOnly && (
            <>
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                <span className="text-sm font-medium shrink-0" id="files-associate-label">
                  Associate with:
                </span>
                <Select
                  value={selectedKrId ?? 'objective'}
                  onValueChange={(v) => setSelectedKrId(v === 'objective' ? null : v)}
                >
                  <SelectTrigger className="w-full sm:w-[220px] min-h-[44px]" aria-labelledby="files-associate-label">
                    <SelectValue placeholder="Objective" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="objective">This objective</SelectItem>
                    {keyResults.map((kr) => (
                      <SelectItem key={kr._id} value={kr._id!}>
                        {kr.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {uploadErrors.length > 0 && (
                <ul className="text-sm text-destructive list-disc list-inside space-y-1" role="alert">
                  {uploadErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
              <label
                htmlFor={fileInputId}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors min-h-[120px] flex flex-col items-center justify-center cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2 shrink-0 pointer-events-none" aria-hidden />
                <p className="text-sm text-muted-foreground mb-3 pointer-events-none">
                  Drag and drop files here, or choose files to browse.
                </p>
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  id={fileInputId}
                  accept={Array.from(ALLOWED_EXTENSIONS).map((e) => `.${e}`).join(',')}
                  onChange={(e) => {
                    processFileList(e.target.files);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  className="min-h-[44px] min-w-[44px] touch-manipulation"
                  onClick={(ev) => {
                    ev.preventDefault();
                    document.getElementById(fileInputId)?.click();
                  }}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
                      Uploading…
                    </>
                  ) : (
                    'Choose files'
                  )}
                </Button>
              </label>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
          <p className="text-sm text-muted-foreground">
            Thumbnail, name, size, and upload date. Preview and download use a secure access check.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files yet.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
              {attachments.map((att) => (
                <li key={att._id}>
                  <Card className="overflow-hidden h-full flex flex-col">
                    <button
                      type="button"
                      className="aspect-video bg-muted flex items-center justify-center cursor-pointer w-full border-0 p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      onClick={() => setPreview(att)}
                      aria-label={`Preview ${att.fileName}`}
                    >
                      {isImageType(att.fileType) && !isPlaceholderAttachmentUrl(att.url) ? (
                        <img
                          src={att.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : isImageType(att.fileType) && isPlaceholderAttachmentUrl(att.url) ? (
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs p-4 text-center">
                          <File className="h-10 w-10 opacity-50" />
                          No preview URL — re-upload with Cloudinary configured
                        </div>
                      ) : (
                        <div
                          className="flex flex-col items-center justify-center gap-2 text-muted-foreground w-full h-full"
                          aria-hidden
                        >
                          {isPdfType(att.fileType) ? (
                            <FileText className="h-12 w-12 text-red-600/80" />
                          ) : isOfficeDocType(att.fileType, att.fileName) ? (
                            <FileText className="h-12 w-12 text-blue-600/80" />
                          ) : (
                            <File className="h-12 w-12" />
                          )}
                          <span className="text-xs font-semibold tracking-wide">{extensionLabel(att.fileName)}</span>
                        </div>
                      )}
                    </button>
                    <CardContent className="p-3 flex-1 flex flex-col">
                      <p className="font-medium text-sm truncate" title={att.fileName}>
                        {att.fileName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatSize(att.fileSize)} · {formatDateTime(att.uploadedAt)}
                      </p>
                      <p className="text-xs font-medium text-foreground mt-1">
                        {att.keyResultId
                          ? `Key result: ${keyResults.find((k) => k._id === att.keyResultId)?.title ?? att.keyResultId}`
                          : 'Objective-level file'}
                      </p>
                      {isPlaceholderAttachmentUrl(att.url) && (
                        <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-500/10 rounded px-2 py-1 mt-2">
                          Placeholder file record — download/preview need a real storage URL. New uploads use your
                          configured file storage.
                        </p>
                      )}
                      <div className="flex gap-2 mt-auto pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px] min-w-[44px] touch-manipulation"
                          type="button"
                          onClick={() => att._id && openDownload(att._id)}
                          aria-label={`Download ${att.fileName}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {!readOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive min-h-[44px] min-w-[44px] touch-manipulation"
                            type="button"
                            onClick={() => att._id && handleDelete(att._id)}
                            aria-label={`Delete ${att.fileName}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 shrink-0" aria-hidden />
            File deletion audit
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Immutable log of removed files (who deleted, when, and original metadata).
          </p>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <p className="text-sm text-muted-foreground">Loading audit…</p>
          ) : deletionLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deletions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-2 font-medium">Deleted</th>
                    <th className="p-2 font-medium">File</th>
                    <th className="p-2 font-medium">Size</th>
                    <th className="p-2 font-medium">Scope</th>
                    <th className="p-2 font-medium">Deleted by</th>
                  </tr>
                </thead>
                <tbody>
                  {deletionLog.map((row) => (
                    <tr key={row._id} className="border-b last:border-0">
                      <td className="p-2 whitespace-nowrap text-muted-foreground">
                        {row.deletedAt ? formatDateTime(row.deletedAt) : '—'}
                      </td>
                      <td className="p-2 max-w-[200px] truncate" title={row.fileName}>
                        {row.fileName}
                      </td>
                      <td className="p-2 whitespace-nowrap">{formatSize(row.fileSize)}</td>
                      <td className="p-2 text-muted-foreground">
                        {row.keyResultId
                          ? `KR: ${keyResults.find((k) => k._id === row.keyResultId)?.title ?? row.keyResultId}`
                          : 'Objective'}
                      </td>
                      <td className="p-2 text-muted-foreground">{displayUserId(row.deletedBy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="file-preview-title"
        >
          <div
            ref={previewPanelRef}
            className="bg-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden border shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 flex flex-wrap justify-between items-center gap-2 border-b shrink-0">
              <span id="file-preview-title" className="font-medium truncate min-w-0 px-1">
                {preview.fileName}
              </span>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] touch-manipulation"
                  type="button"
                  disabled={!preview._id}
                  onClick={() => preview._id && openDownload(preview._id)}
                >
                  <Download className="h-4 w-4 mr-1" aria-hidden /> Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] min-w-[44px] touch-manipulation"
                  type="button"
                  onClick={() => setPreview(null)}
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="p-4 flex-1 min-h-0 overflow-auto flex items-center justify-center">
              {previewLoading && (
                <div className="flex flex-col items-center gap-2 text-muted-foreground py-12">
                  <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
                  <span className="text-sm">Loading preview…</span>
                </div>
              )}
              {!previewLoading && previewResolved && isImageType(previewResolved.fileType) && (
                <img
                  src={previewResolved.url}
                  alt={previewResolved.fileName}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              )}
              {!previewLoading && previewResolved && isPdfType(previewResolved.fileType) && (
                <iframe
                  src={previewResolved.url}
                  title={previewResolved.fileName}
                  className="w-full min-h-[80vh] border-0 rounded"
                />
              )}
              {!previewLoading &&
                previewResolved &&
                !isImageType(previewResolved.fileType) &&
                !isPdfType(previewResolved.fileType) &&
                isOfficeDocType(previewResolved.fileType, previewResolved.fileName) && (
                  <iframe
                    src={officeViewerUrl(previewResolved.url)}
                    title={previewResolved.fileName}
                    className="w-full min-h-[80vh] border-0 rounded bg-muted"
                  />
                )}
              {!previewLoading &&
                previewResolved &&
                !isImageType(previewResolved.fileType) &&
                !isPdfType(previewResolved.fileType) &&
                !isOfficeDocType(previewResolved.fileType, previewResolved.fileName) && (
                  <p className="text-muted-foreground text-center">
                    Preview not available for this type.{' '}
                    <button
                      type="button"
                      className="underline text-primary font-medium"
                      onClick={() => preview._id && openDownload(preview._id)}
                    >
                      Download
                    </button>
                  </p>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
