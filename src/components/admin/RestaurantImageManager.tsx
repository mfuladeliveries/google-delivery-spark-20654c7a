import { useState, useEffect, useRef, useCallback } from "react";
import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon, X, Trash2, Save, Loader2, XCircle, RotateCw } from "lucide-react";
import { toast } from "sonner";

// Custom error thrown when a user cancels an in-flight upload.
class UploadCancelledError extends Error {
  constructor() {
    super("cancelled");
    this.name = "UploadCancelledError";
  }
}

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // 2MB original-file cap (pre-compression)
const FALLBACK_IMG = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=300&fit=crop";

// Compression presets per image kind — keeps quality high where it matters
// (banner/gallery) and shrinks logos aggressively since they render small.
const COMPRESSION_OPTS: Record<"logo" | "banner" | "gallery", {
  maxSizeMB: number;
  maxWidthOrHeight: number;
}> = {
  logo:    { maxSizeMB: 0.15, maxWidthOrHeight: 512 },
  banner:  { maxSizeMB: 0.5,  maxWidthOrHeight: 1600 },
  gallery: { maxSizeMB: 0.4,  maxWidthOrHeight: 1400 },
};

const compressImage = async (
  file: File,
  kind: "logo" | "banner" | "gallery",
  signal?: AbortSignal,
  onProgress?: (percent: number) => void,
): Promise<File> => {
  try {
    const opts = COMPRESSION_OPTS[kind];
    const compressed = await imageCompression(file, {
      ...opts,
      useWebWorker: true,
      initialQuality: 0.82,
      fileType: file.type === "image/png" ? "image/png" : "image/webp",
      signal,
      onProgress: (p: number) => {
        if (signal?.aborted) throw new UploadCancelledError();
        onProgress?.(Math.max(0, Math.min(100, p)));
      },
    });
    if (signal?.aborted) throw new UploadCancelledError();
    // Preserve a sensible filename + extension
    const ext = compressed.type === "image/png" ? "png" : "webp";
    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([compressed], `${base}.${ext}`, { type: compressed.type });
  } catch (err: any) {
    if (signal?.aborted || err?.name === "AbortError" || err instanceof UploadCancelledError) {
      throw new UploadCancelledError();
    }
    // If compression fails for any other reason, fall back to the original file.
    return file;
  }
};

interface Props {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
  onSaved: () => void;
}

interface ImageState {
  logo_url: string | null;
  banner_url: string | null;
  gallery_images: string[];
}

// One row per in-flight file shown in the progress list.
type UploadStage = "compressing" | "uploading" | "done" | "error" | "cancelled";
interface UploadProgress {
  id: string;
  name: string;
  kind: "logo" | "banner" | "gallery";
  stage: UploadStage;
  // 0-100 — covers compression (0-70) then upload completion (70-100).
  percent: number;
  error?: string;
  // Original File kept so failed/cancelled rows can be retried in-place.
  file: File;
}

const validateFile = (file: File): string | null => {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Only JPG, PNG, or WebP images are allowed";
  if (file.size > MAX_BYTES) return `Image must be under 2MB (got ${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  return null;
};

const uploadToBucket = async (
  file: File,
  restaurantId: string,
  kind: "logo" | "banner" | "gallery",
  signal: AbortSignal,
  onProgress?: (stage: UploadStage, percent: number) => void,
): Promise<string> => {
  // Compression: map library 0-100 → overall 0-70.
  const compressed = await compressImage(file, kind, signal, (p) => {
    onProgress?.("compressing", Math.round(p * 0.7));
  });
  if (signal.aborted) throw new UploadCancelledError();
  onProgress?.("uploading", 75);
  const ext = (compressed.name.split(".").pop() || "webp").toLowerCase();
  const path = `restaurant-images/${restaurantId}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // Race the upload against the abort signal so cancellation feels instant
  // even though supabase-js doesn't natively accept an AbortSignal here.
  const uploadPromise = supabase.storage.from("food-images").upload(path, compressed, {
    upsert: false,
    contentType: compressed.type,
    cacheControl: "3600",
  });
  const abortPromise = new Promise<never>((_, reject) => {
    if (signal.aborted) return reject(new UploadCancelledError());
    signal.addEventListener("abort", () => reject(new UploadCancelledError()), { once: true });
  });
  const { error } = await Promise.race([uploadPromise, abortPromise]);
  if (signal.aborted) {
    // Best-effort cleanup if the upload actually completed before we noticed.
    supabase.storage.from("food-images").remove([path]).catch(() => {});
    throw new UploadCancelledError();
  }
  if (error) throw error;
  onProgress?.("done", 100);
  const { data } = supabase.storage.from("food-images").getPublicUrl(path);
  return data.publicUrl;
};

const RestaurantImageManager = ({ open, onClose, restaurantId, restaurantName, onSaved }: Props) => {
  const [state, setState] = useState<ImageState>({ logo_url: null, banner_url: null, gallery_images: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<"logo" | "banner" | "gallery" | null>(null);
  const [dragKind, setDragKind] = useState<"logo" | "banner" | "gallery" | null>(null);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const galleryRef = useRef<HTMLInputElement>(null);
  // Map of upload id → AbortController so we can cancel individual files.
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  const updateProgress = useCallback((id: string, patch: Partial<UploadProgress>) => {
    setProgress((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const cancelUpload = useCallback((id: string) => {
    const ctrl = controllersRef.current.get(id);
    if (!ctrl) return;
    ctrl.abort();
    controllersRef.current.delete(id);
    // Optimistic UI: flip the row to "cancelled" immediately.
    setProgress((list) =>
      list.map((p) =>
        p.id === id && p.stage !== "done" && p.stage !== "error"
          ? { ...p, stage: "cancelled", error: "Cancelled" }
          : p,
      ),
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("logo_url, banner_url, gallery_images")
        .eq("id", restaurantId)
        .single();
      if (cancelled) return;
      if (error) {
        toast.error("Failed to load images");
      } else {
        setState({
          logo_url: data.logo_url,
          banner_url: data.banner_url,
          gallery_images: data.gallery_images || [],
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, restaurantId]);

  // Single-file upload helper used by both initial uploads and retries.
  // Resolves with the public URL on success, or null on cancel/error
  // (the row's stage is already updated in either case).
  const runUpload = useCallback(
    async (entry: UploadProgress): Promise<string | null> => {
      const ctrl = controllersRef.current.get(entry.id);
      if (!ctrl || ctrl.signal.aborted) return null;
      try {
        const url = await uploadToBucket(entry.file, restaurantId, entry.kind, ctrl.signal, (stage, percent) =>
          updateProgress(entry.id, { stage, percent }),
        );
        return url;
      } catch (err: any) {
        if (err instanceof UploadCancelledError || ctrl.signal.aborted) {
          updateProgress(entry.id, { stage: "cancelled", error: "Cancelled" });
          return null;
        }
        updateProgress(entry.id, { stage: "error", error: err?.message || "Upload failed" });
        toast.error(`${entry.name}: ${err?.message || "Upload failed"}`);
        return null;
      } finally {
        controllersRef.current.delete(entry.id);
      }
    },
    [restaurantId, updateProgress],
  );

  // Apply the resulting URL to the right slot in component state and toast.
  const applyUploadedUrl = useCallback((kind: "logo" | "banner" | "gallery", url: string) => {
    if (kind === "gallery") {
      setState((s) => ({ ...s, gallery_images: [...s.gallery_images, url] }));
      toast.success("Gallery image uploaded");
    } else {
      setState((s) => ({ ...s, [`${kind}_url`]: url }));
      toast.success(`${kind === "logo" ? "Logo" : "Banner"} uploaded`);
    }
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[], kind: "logo" | "banner" | "gallery") => {
      const arr = Array.from(files);
      if (arr.length === 0) return;
      // Validate all first
      for (const f of arr) {
        const err = validateFile(f);
        if (err) {
          toast.error(`${f.name}: ${err}`);
          return;
        }
      }
      setUploadingKind(kind);

      // Seed progress entries + per-file AbortControllers.
      const entries: UploadProgress[] = arr.map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        kind,
        stage: "compressing",
        percent: 0,
        file: f,
      }));
      entries.forEach((e) => controllersRef.current.set(e.id, new AbortController()));
      setProgress((list) => [...list, ...entries]);

      try {
        // Upload all in parallel — one failure won't block the others.
        const results = await Promise.all(entries.map((e) => runUpload(e)));
        const urls = results.filter((u): u is string => Boolean(u));
        if (kind === "gallery") {
          if (urls.length > 0) {
            setState((s) => ({ ...s, gallery_images: [...s.gallery_images, ...urls] }));
            toast.success(`${urls.length} gallery image${urls.length > 1 ? "s" : ""} uploaded`);
          }
        } else if (urls[0]) {
          setState((s) => ({ ...s, [`${kind}_url`]: urls[0] }));
          toast.success(`${kind === "logo" ? "Logo" : "Banner"} uploaded`);
        }
      } finally {
        setUploadingKind(null);
        // Auto-clear successful rows after a short delay so admins see them complete.
        const ids = new Set(entries.map((e) => e.id));
        setTimeout(() => {
          setProgress((list) => list.filter((p) => !(ids.has(p.id) && p.stage === "done")));
        }, 1500);
      }
    },
    [restaurantId, runUpload],
  );

  // Retry a single failed/cancelled row using its original File.
  const retryUpload = useCallback(
    async (id: string) => {
      const target = progress.find((p) => p.id === id);
      if (!target || (target.stage !== "error" && target.stage !== "cancelled")) return;
      // Reset row state and give it a fresh AbortController.
      controllersRef.current.set(id, new AbortController());
      updateProgress(id, { stage: "compressing", percent: 0, error: undefined });
      setUploadingKind(target.kind);
      try {
        const url = await runUpload(target);
        if (url) applyUploadedUrl(target.kind, url);
      } finally {
        setUploadingKind(null);
        // Auto-clear if this row finished cleanly.
        setTimeout(() => {
          setProgress((list) => list.filter((p) => !(p.id === id && p.stage === "done")));
        }, 1500);
      }
    },
    [progress, runUpload, updateProgress, applyUploadedUrl],
  );

  const removeGalleryImage = (url: string) => {
    setState((s) => ({ ...s, gallery_images: s.gallery_images.filter((u) => u !== url) }));
  };

  const clearLogo = () => setState((s) => ({ ...s, logo_url: null }));
  const clearBanner = () => setState((s) => ({ ...s, banner_url: null }));

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("restaurants")
      .update({
        logo_url: state.logo_url,
        banner_url: state.banner_url,
        gallery_images: state.gallery_images,
        // keep legacy `logo` in sync so older code paths still work
        logo: state.logo_url || "",
      })
      .eq("id", restaurantId);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Failed to save");
      return;
    }
    toast.success("Restaurant images updated successfully");
    onSaved();
    onClose();
  };

  const onDrop = (e: React.DragEvent, kind: "logo" | "banner" | "gallery") => {
    e.preventDefault();
    setDragKind(null);
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files, kind);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">🖼️ Manage images — {restaurantName}</DialogTitle>
          <DialogDescription className="text-xs">
            JPG, PNG or WebP · max 2MB per image · auto-compressed before upload · changes save when you click "Save Changes"
          </DialogDescription>
        </DialogHeader>

        {progress.length > 0 && (
          <div className="rounded-2xl border border-border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Processing ({progress.filter((p) => p.stage === "compressing" || p.stage === "uploading").length} active)
              </h4>
              {progress.every((p) => p.stage === "done" || p.stage === "error" || p.stage === "cancelled") && (
                <button
                  type="button"
                  onClick={() => setProgress([])}
                  className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {progress.map((p) => {
                const isActive = p.stage === "compressing" || p.stage === "uploading";
                const stageLabel =
                  p.stage === "compressing"
                    ? "Compressing…"
                    : p.stage === "uploading"
                    ? "Uploading…"
                    : p.stage === "done"
                    ? "Done"
                    : p.stage === "cancelled"
                    ? "Cancelled"
                    : "Failed";
                const barColor =
                  p.stage === "error"
                    ? "bg-destructive"
                    : p.stage === "cancelled"
                    ? "bg-muted-foreground"
                    : p.stage === "done"
                    ? "bg-emerald-500"
                    : "bg-primary";
                const labelColor =
                  p.stage === "error"
                    ? "text-destructive"
                    : p.stage === "cancelled"
                    ? "text-muted-foreground italic"
                    : "text-muted-foreground";
                return (
                  <li key={p.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate font-medium text-foreground">
                        <span className="mr-1 rounded bg-card px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
                          {p.kind}
                        </span>
                        {p.name}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`font-semibold ${labelColor}`}>
                          {p.stage === "error" || p.stage === "cancelled"
                            ? p.error || stageLabel
                            : `${stageLabel} ${p.percent}%`}
                        </span>
                        {isActive && (
                          <button
                            type="button"
                            onClick={() => cancelUpload(p.id)}
                            title="Cancel upload"
                            aria-label={`Cancel upload of ${p.name}`}
                            className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-card">
                      <div
                        className={`h-full ${barColor} transition-all duration-200`}
                        style={{ width: `${p.stage === "error" || p.stage === "cancelled" ? 100 : p.percent}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* LOGO */}
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Logo</h3>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragKind("logo");
                }}
                onDragLeave={() => setDragKind(null)}
                onDrop={(e) => onDrop(e, "logo")}
                className={`flex items-center gap-4 rounded-2xl border-2 border-dashed p-4 transition-colors ${
                  dragKind === "logo" ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                  {state.logo_url ? (
                    <img src={state.logo_url} alt="Logo" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).src = FALLBACK_IMG)} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-2">Round logo shown on cards. Recommended square image.</p>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                      {uploadingKind === "logo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {state.logo_url ? "Replace" : "Upload"} logo
                      <input
                        type="file"
                        accept={ACCEPTED_TYPES.join(",")}
                        className="hidden"
                        disabled={uploadingKind !== null}
                        onChange={(e) => e.target.files && handleFiles(e.target.files, "logo")}
                      />
                    </label>
                    {state.logo_url && (
                      <button
                        type="button"
                        onClick={clearLogo}
                        className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* BANNER */}
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Banner</h3>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragKind("banner");
                }}
                onDragLeave={() => setDragKind(null)}
                onDrop={(e) => onDrop(e, "banner")}
                className={`rounded-2xl border-2 border-dashed p-3 transition-colors ${
                  dragKind === "banner" ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="relative aspect-[3/1] w-full overflow-hidden rounded-xl bg-muted mb-3">
                  {state.banner_url ? (
                    <img src={state.banner_url} alt="Banner" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).src = FALLBACK_IMG)} />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                      <span className="text-xs">No banner uploaded</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                    {uploadingKind === "banner" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {state.banner_url ? "Replace" : "Upload"} banner
                    <input
                      type="file"
                      accept={ACCEPTED_TYPES.join(",")}
                      className="hidden"
                      disabled={uploadingKind !== null}
                      onChange={(e) => e.target.files && handleFiles(e.target.files, "banner")}
                    />
                  </label>
                  {state.banner_url && (
                    <button
                      type="button"
                      onClick={clearBanner}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  )}
                  <span className="ml-auto self-center text-[10px] text-muted-foreground">Tip: drag & drop a file here</span>
                </div>
              </div>
            </section>

            {/* GALLERY */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Gallery ({state.gallery_images.length})
                </h3>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {uploadingKind === "gallery" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Add images
                  <input
                    ref={galleryRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    multiple
                    className="hidden"
                    disabled={uploadingKind !== null}
                    onChange={(e) => {
                      if (e.target.files) handleFiles(e.target.files, "gallery");
                      if (galleryRef.current) galleryRef.current.value = "";
                    }}
                  />
                </label>
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragKind("gallery");
                }}
                onDragLeave={() => setDragKind(null)}
                onDrop={(e) => onDrop(e, "gallery")}
                className={`rounded-2xl border-2 border-dashed p-3 transition-colors ${
                  dragKind === "gallery" ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                {state.gallery_images.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-1 py-8 text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                    <p className="text-xs font-medium">No gallery images yet</p>
                    <p className="text-[10px]">Drag & drop or use "Add images"</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {state.gallery_images.map((url, idx) => (
                      <div
                        key={`${url}-${idx}`}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
                      >
                        <img
                          src={url}
                          alt={`Gallery ${idx + 1}`}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          onError={(e) => ((e.target as HTMLImageElement).src = FALLBACK_IMG)}
                        />
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(url)}
                          className="absolute top-1 right-1 rounded-full bg-card/95 p-1 opacity-0 shadow-card transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                          title="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || uploadingKind !== null}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RestaurantImageManager;
