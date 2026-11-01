/* eslint-disable react-hooks/set-state-in-effect */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import {
  cachePosterFile,
  cachePosters,
  deleteAllCachedPosters,
  deleteCachedPoster,
  getCachedPosterFile,
  getCachedPosters,
  getQueuedSubmissions,
  syncQueuedSubmissions,
} from "@/lib/offline-storage";

import {
  ArrowUpRight,
  BookOpen,
  Download,
  FileText,
  Filter,
  GraduationCap,
  LoaderCircle,
  Search,
  Trash2,
  Wifi,
  WifiOff,
  X,
  RefreshCw,
} from "lucide-react";

type PosterSubmission = {
  id: string;

  authorName: string;

  email: string;

  institution: string;

  department: string;

  coAuthors: string;

  title: string;

  category: string;

  abstract: string;

  keywords: string;

  fileName: string;

  fileType: string;

  fileSize: number;

  fileUrl: string;

  status?: string;

  createdAt?: string;
};

const categories = [
  "All",
  "Clinical Research",
  "Basic Science",
  "Case Report",

  "Public Health",
  "Technology & Innovation",
  "Other",
];

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Size unavailable";

  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value?: string) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function inferPosterMimeType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",

    png: "image/png",

    jpg: "image/jpeg",

    jpeg: "image/jpeg",

    ppt: "application/vnd.ms-powerpoint",

    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    doc: "application/msword",

    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };

  return mimeTypes[extension] ?? "application/octet-stream";
}

function resolvePosterFileUrl(poster: PosterSubmission): string {
  // Prefer the URL returned by the API, but fall back to the known file route.

  return (
    poster.fileUrl || `/api/submissions/${encodeURIComponent(poster.id)}/file`
  );
}

function isImage(poster: PosterSubmission) {
  const name = poster.fileName.toLowerCase();

  return (
    poster.fileType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp)$/i.test(name)
  );
}

function isPdf(poster: PosterSubmission) {
  return (
    poster.fileType === "application/pdf" ||
    poster.fileName.toLowerCase().endsWith(".pdf")
  );
}

/**

 * Cache cloud poster files while online so preview/download can work later offline.

 * Files are downloaded in small batches to avoid opening too many requests at once.

 */

async function cacheCloudPosterFiles(posters: PosterSubmission[]) {
  const batchSize = 3;

  for (let index = 0; index < posters.length; index += batchSize) {
    const batch = posters.slice(index, index + batchSize);

    await Promise.allSettled(
      batch.map(async (poster) => {
        const fileUrl = resolvePosterFileUrl(poster);

        const alreadyCached = await getCachedPosterFile(poster.id);

        if (alreadyCached?.blob) return;

        const response = await fetch(fileUrl, { cache: "no-store" });

        if (!response.ok) throw new Error(`Unable to cache ${poster.fileName}`);

        const blob = await response.blob();

        await cachePosterFile(
          poster.id,

          blob,

          poster.fileName,

          blob.type || poster.fileType || "application/octet-stream",
        );
      }),
    );
  }
}

export default function PostersPage() {
  const [posters, setPosters] = useState<PosterSubmission[]>([]);

  const [search, setSearch] = useState("");

  const [category, setCategory] = useState("All");

  const [isOnline, setIsOnline] = useState(true);

  const [isLoading, setIsLoading] = useState(true);

  const [loadError, setLoadError] = useState("");

  const [selectedPoster, setSelectedPoster] = useState<PosterSubmission | null>(
    null,
  );

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [pendingCount, setPendingCount] = useState(0);

  const [deleteBusy, setDeleteBusy] = useState(false);

  const [notice, setNotice] = useState("");

  const [actionError, setActionError] = useState("");

  const [showAdminTools, setShowAdminTools] = useState(false);

  const loadPosters = useCallback(async () => {
    setIsLoading(true);

    setLoadError("");

    setActionError("");

    try {
      let cloudPosters: PosterSubmission[] = [];

      let cloudLoaded = false;

      // Load cloud records when possible. If the request fails, continue with local data.

      if (navigator.onLine) {
        try {
          const syncResult = await syncQueuedSubmissions();

          setPendingCount(syncResult.remaining);

          const response = await fetch("/api/submissions", {
            method: "GET",

            cache: "no-store",

            headers: { Accept: "application/json" },
          });

          const data = await response.json().catch(() => null);

          if (!response.ok)
            throw new Error(data?.error || "Unable to load submissions.");

          if (!Array.isArray(data?.submissions)) {
            throw new Error(
              "The submissions API returned an unexpected response.",
            );
          }

          cloudPosters = data.submissions as PosterSubmission[];

          await cachePosters(cloudPosters);

          cloudLoaded = true;

          // Cache each cloud poster's actual file as well as its metadata.

          // This is what allows preview and download to work after going offline.

          await cacheCloudPosterFiles(cloudPosters);
        } catch (error) {
          console.warn(
            "Cloud gallery unavailable; showing device submissions:",
            error,
          );
        }
      }

      // Always merge the last cloud gallery cache with queued offline submissions.

      const cachedPosters = await getCachedPosters();

      const queued = await getQueuedSubmissions();

      setPendingCount(queued.length);

      const queuedPosters: PosterSubmission[] = await Promise.all(
        queued.map(async (item) => {
          await cachePosterFile(
            item.id,

            item.file,

            item.file.name,

            item.file.type || "application/octet-stream",
          );

          return {
            id: item.id,

            authorName: item.fields.authorName,

            email: item.fields.email,

            institution: item.fields.institution,

            department: item.fields.department,

            coAuthors: item.fields.coAuthors,

            title: item.fields.title,

            category: item.fields.category,

            abstract: item.fields.abstract,

            keywords: item.fields.keywords,

            fileName: item.file.name,

            fileType: item.file.type || inferPosterMimeType(item.file.name),

            fileSize: item.file.size,

            fileUrl: "",

            status: "Pending sync",

            createdAt: item.createdAt,

            syncStatus: "pending",
          } as PosterSubmission;
        }),
      );

      const basePosters = cloudLoaded
        ? cloudPosters
        : (cachedPosters as PosterSubmission[]);

      const merged = new Map<string, PosterSubmission>();

      // Cached data provides fallback files and metadata; fresh cloud data wins for matching IDs.

      if (!cloudLoaded) {
        for (const poster of cachedPosters as PosterSubmission[])
          merged.set(poster.id, poster);
      }

      for (const poster of basePosters) merged.set(poster.id, poster);

      for (const poster of queuedPosters) merged.set(poster.id, poster);

      const allPosters = Array.from(merged.values()).sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );

      setPosters(allPosters);

      if (!cloudLoaded) {
        if (allPosters.length === 0) {
          setLoadError(
            "No submissions are saved on this device yet. Connect once to load the cloud gallery, then cached submissions will be available offline.",
          );
        } else {
          setNotice(
            navigator.onLine
              ? "Showing saved submissions from this device because the cloud gallery could not be reached."
              : "Offline gallery: showing cached cloud submissions and offline submissions waiting to sync.",
          );
        }
      } else {
        setNotice(
          queuedPosters.length
            ? `${queuedPosters.length} offline submission${queuedPosters.length === 1 ? "" : "s"} waiting to sync.`
            : "",
        );
      }
    } catch (error) {
      console.error("Unable to load gallery:", error);

      setLoadError(
        error instanceof Error
          ? error.message
          : "We couldn't load submissions.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosters();

    const updateConnection = () => {
      setIsOnline(navigator.onLine);

      if (navigator.onLine) void loadPosters();
    };

    updateConnection();

    window.addEventListener("online", updateConnection);

    window.addEventListener("offline", updateConnection);

    // Reveal the discreet admin control with Ctrl+Shift+D (or Cmd+Shift+D on Mac).

    // This only hides the UI; the server-side deletion token remains the real protection.

    const handleAdminShortcut = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "d"
      ) {
        event.preventDefault();

        setShowAdminTools((visible) => !visible);
      }

      if (event.key === "Escape") setShowAdminTools(false);
    };

    window.addEventListener("keydown", handleAdminShortcut);

    return () => {
      window.removeEventListener("online", updateConnection);

      window.removeEventListener("offline", updateConnection);

      window.removeEventListener("keydown", handleAdminShortcut);
    };
  }, [loadPosters]);

  const filteredPosters = useMemo(() => {
    const query = search.trim().toLowerCase();

    return posters.filter((poster) => {
      const matchesCategory =
        category === "All" || poster.category === category;

      const searchableText = [
        poster.id,
        poster.title,
        poster.authorName,
        poster.coAuthors,

        poster.institution,
        poster.department,
        poster.keywords,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesCategory && searchableText.includes(query);
    });
  }, [posters, search, category]);

  async function openPosterPreview(poster: PosterSubmission) {
    setActionError("");

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    try {
      let blob: Blob | undefined;

      let resolvedType = poster.fileType;

      const cached = await getCachedPosterFile(poster.id);

      if (cached?.blob) {
        blob = cached.blob;

        resolvedType =
          cached.fileType && cached.fileType !== "application/octet-stream"
            ? cached.fileType
            : inferPosterMimeType(cached.fileName || poster.fileName);
      }

      // Pending offline submissions already contain the original file in IndexedDB.

      if (!blob) {
        const queued = (await getQueuedSubmissions()).find(
          (item) => item.id === poster.id,
        );

        if (queued?.file) {
          blob = queued.file;

          resolvedType =
            queued.file.type || inferPosterMimeType(queued.file.name);

          await cachePosterFile(
            poster.id,
            blob,
            queued.file.name,
            resolvedType,
          );
        }
      }

      // If online, fetch a cloud file once and persist it for future offline use.

      if (!blob && navigator.onLine) {
        const response = await fetch(resolvePosterFileUrl(poster), {
          cache: "no-store",
        });

        if (!response.ok) throw new Error("Could not load the poster file.");

        blob = await response.blob();

        resolvedType =
          blob.type || resolvedType || inferPosterMimeType(poster.fileName);

        await cachePosterFile(poster.id, blob, poster.fileName, resolvedType);
      }

      if (!blob) {
        throw new Error(
          "This poster file is not saved on this device yet. Connect to the internet and preview or download it once to make it available offline.",
        );
      }

      setSelectedPoster({
        ...poster,
        fileType: resolvedType || inferPosterMimeType(poster.fileName),
      });

      setPreviewUrl(URL.createObjectURL(blob));
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Preview failed.",
      );
    }
  }

  async function deleteAllSubmissions() {
    setActionError("");

    setNotice("");

    if (posters.length === 0) {
      setNotice("There are no submissions to delete.");

      return;
    }

    const confirmed = window.confirm(
      `Permanently delete all ${posters.length} submissions and their poster files? This cannot be undone.`,
    );

    if (!confirmed) return;

    const token = window.prompt(
      "Enter the admin deletion token configured as EPOSTER_ADMIN_DELETE_TOKEN on the server:",
    );

    if (token === null || !token.trim()) return;

    setDeleteBusy(true);

    try {
      const response = await fetch("/api/submissions", {
        method: "DELETE",

        headers: {
          "x-admin-delete-token": token.trim(),
          Accept: "application/json",
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok)
        throw new Error(data?.error || "Unable to delete submissions.");

      setPosters([]);

      await deleteAllCachedPosters();

      setSelectedPoster(null);

      if (previewUrl) URL.revokeObjectURL(previewUrl);

      setPreviewUrl(null);

      setNotice(
        `Deleted ${data?.deletedSubmissions ?? "all"} submissions and ${data?.deletedFiles ?? "associated"} poster files.`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Deletion failed. Please try again.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  async function deleteOneSubmission(poster: PosterSubmission) {
    if (poster.id.startsWith("offline-")) {
      setActionError(
        "This submission is still waiting to sync. Reconnect first, then delete it from the cloud gallery.",
      );
      return;
    }

    setActionError("");
    setNotice("");

    const confirmed = window.confirm(
      `Permanently delete "${poster.title}" by ${poster.authorName}, including its poster file? This cannot be undone.`,
    );

    if (!confirmed) return;

    setDeleteBusy(true);

    try {
      const response = await fetch(
        `/api/submissions/${encodeURIComponent(poster.id)}/file`,
        {
          method: "DELETE",
          headers: { Accept: "application/json" },
        },
      );

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to delete this submission.");
      }

      setPosters((current) => current.filter((item) => item.id !== poster.id));

      await deleteCachedPoster(poster.id);

      if (selectedPoster?.id === poster.id) {
        setSelectedPoster(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      setNotice(`Deleted "${poster.title}" and its poster file.`);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Deletion failed. Please try again.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  async function downloadPoster(poster: PosterSubmission) {
    try {
      let blob: Blob | undefined;

      const cached = await getCachedPosterFile(poster.id);

      if (cached?.blob) blob = cached.blob;

      // Pending offline submissions can be downloaded straight from their queued File.

      if (!blob) {
        const queued = (await getQueuedSubmissions()).find(
          (item) => item.id === poster.id,
        );

        if (queued?.file) {
          blob = queued.file;

          await cachePosterFile(
            poster.id,

            blob,

            queued.file.name,

            queued.file.type || inferPosterMimeType(queued.file.name),
          );
        }
      }

      // Cloud files are cached on the first successful online download.

      if (!blob && navigator.onLine) {
        const response = await fetch(resolvePosterFileUrl(poster), {
          cache: "no-store",
        });

        if (!response.ok)
          throw new Error("Could not download the poster file.");

        blob = await response.blob();

        await cachePosterFile(
          poster.id,

          blob,

          poster.fileName,

          blob.type || poster.fileType || inferPosterMimeType(poster.fileName),
        );
      }

      if (!blob) {
        throw new Error(
          "This poster file is not saved on this device yet. Connect to the internet and download it once to make it available offline.",
        );
      }

      const url = URL.createObjectURL(blob);

      const anchor = document.createElement("a");

      anchor.href = url;

      anchor.download = poster.fileName || `${poster.id}-poster`;

      document.body.appendChild(anchor);

      anchor.click();

      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Download failed.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <FileText size={22} />
            </span>

            <span>
              <span className="block text-lg font-extrabold tracking-tight">
                ePoster<span className="text-blue-600">.</span>
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                Research gallery
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className={`hidden items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold sm:flex ${isOnline ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}
            >
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              {isOnline ? "Online" : "Offline"}
            </div>

            <button
              type="button"
              onClick={() => void loadPosters()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
              aria-label="Refresh submissions"
            >
              <RefreshCw
                size={16}
                className={isLoading ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {showAdminTools && posters.length > 0 && (
              <button
                type="button"
                onClick={() => void deleteAllSubmissions()}
                disabled={deleteBusy || !isOnline}
                title="Admin control (Ctrl+Shift+D to hide)"
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={16} />

                <span className="hidden sm:inline">
                  {deleteBusy ? "Deleting..." : "Delete all"}
                </span>
              </button>
            )}

            <Link
              href="/submit"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-blue-700 sm:px-4"
            >
              Submit ePoster <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.10),transparent_55%)]" />

        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                <BookOpen size={14} /> Scientific research showcase
              </div>

              <h1 className="mt-5 text-4xl leading-tight font-black tracking-tight text-slate-950 sm:text-5xl">
                Explore ePosters
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
                Browse cloud submissions or the last gallery saved on this
                device. Previewed or downloaded files are stored locally for
                offline access.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[300px]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <FileText size={17} />
                  <span className="text-xs font-semibold">
                    {isOnline ? "Cloud submissions" : "Cached submissions"}
                  </span>
                </div>
                <p className="mt-3 text-3xl font-black text-slate-950">
                  {isLoading ? "—" : posters.length}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <Filter size={17} />
                  <span className="text-xs font-semibold">Matching</span>
                </div>
                <p className="mt-3 text-3xl font-black text-slate-950">
                  {isLoading ? "—" : filteredPosters.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">
              Research collection
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Search and filter submissions stored in the cloud.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:min-w-[290px]">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search titles, authors, IDs..."
                aria-label="Search posters"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
              <Filter size={16} className="shrink-0 text-slate-400" />
              <select
                aria-label="Filter by category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full bg-transparent py-3 pr-5 text-sm font-semibold text-slate-700 outline-none"
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {pendingCount > 0 && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {pendingCount} offline submission{pendingCount === 1 ? "" : "s"}{" "}
            waiting to upload from this device. Keep this browser data and
            reconnect to sync.
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {notice}
          </div>
        )}

        {actionError && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {actionError}
          </div>
        )}

        {loadError && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {loadError}
            <button
              type="button"
              onClick={() => void loadPosters()}
              className="ml-2 font-bold underline"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-slate-500">
            <LoaderCircle size={32} className="animate-spin text-blue-600" />
            <p className="mt-4 text-sm font-medium">
              Loading cloud submissions...
            </p>
          </div>
        ) : !loadError && filteredPosters.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              {search || category !== "All" ? (
                <Search size={30} />
              ) : (
                <GraduationCap size={32} />
              )}
            </div>
            <h3 className="mt-5 text-lg font-extrabold text-slate-900">
              {search || category !== "All"
                ? "No matching posters"
                : "No submissions yet"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {search || category !== "All"
                ? "Try another search term or category."
                : "Once a submission is saved, it will appear here from MongoDB."}
            </p>
            {(search || category !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("All");
                }}
                className="mt-5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="mt-7 space-y-4">
            {filteredPosters.map((poster) => (
              <article
                key={poster.id}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60"
              >
                <div className="flex min-w-0 flex-col p-5 sm:p-6 lg:p-7">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex max-w-full rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700">
                        {poster.category || "Uncategorized"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDate(poster.createdAt)}
                      </span>
                      {poster.id.startsWith("offline-") && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                          Pending sync
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="max-w-full break-all rounded-lg bg-slate-100 px-2.5 py-2 text-[10px] font-bold text-slate-500">
                        {poster.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => void openPosterPreview(poster)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <BookOpen size={14} /> Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadPoster(poster)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        <Download size={14} /> Download
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteOneSubmission(poster)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void openPosterPreview(poster)}
                    className="mt-3 block text-left text-xl leading-7 font-extrabold text-slate-900 transition hover:text-blue-700 sm:text-2xl"
                  >
                    {poster.title}
                  </button>

                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">
                      {poster.authorName || "Author unavailable"}
                    </span>
                    {poster.department && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span>{poster.department}</span>
                      </>
                    )}
                  </div>

                  {poster.institution && (
                    <p className="mt-1 text-sm text-slate-500">
                      {poster.institution}
                    </p>
                  )}

                  {poster.coAuthors && (
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Co-authors: {poster.coAuthors}
                    </p>
                  )}

                  {poster.abstract && (
                    <p className="mt-3 line-clamp-2 max-w-4xl text-sm leading-6 text-slate-500">
                      {poster.abstract}
                    </p>
                  )}

                  {poster.keywords && (
                    <p className="mt-2 line-clamp-1 text-xs text-slate-400">
                      Keywords: {poster.keywords}
                    </p>
                  )}

                  <p className="mt-3 text-xs text-slate-400">
                    {poster.fileName} · {formatFileSize(poster.fileSize)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-center sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:text-left">
          <Link
            href="/"
            className="text-base font-extrabold tracking-tight text-slate-900"
          >
            ePoster<span className="text-blue-600">.</span>
          </Link>
          <p className="text-xs leading-5 text-slate-500">
            Research made visible. A space to discover and share scientific
            work.
          </p>
          <p className="text-xs text-slate-400">
            © 2026 ePoster. All rights reserved.
          </p>
        </div>
      </footer>

      {selectedPoster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedPoster(null);
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              setPreviewUrl(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="poster-preview-title"
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 sm:p-6">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  {selectedPoster.id}
                </p>
                <h2
                  id="poster-preview-title"
                  className="mt-1 text-lg font-extrabold text-slate-900 sm:text-xl"
                >
                  {selectedPoster.title}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedPoster.authorName} · {selectedPoster.institution}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPoster(null);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                aria-label="Close poster preview"
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
              {isPdf(selectedPoster) ? (
                <iframe
                  title={`Preview of ${selectedPoster.title}`}
                  src={previewUrl || resolvePosterFileUrl(selectedPoster)}
                  className="h-[65vh] w-full rounded-xl border border-slate-200 bg-white"
                />
              ) : isImage(selectedPoster) ? (
                <img
                  src={previewUrl || resolvePosterFileUrl(selectedPoster)}
                  alt={selectedPoster.title}
                  className="mx-auto max-h-[70vh] max-w-full rounded-xl object-contain"
                />
              ) : (
                <div className="p-8 text-center text-sm text-slate-600">
                  This file format cannot be previewed directly in the browser.
                  Use “Download file” to open it in Microsoft Word or
                  PowerPoint, or a compatible application.
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-slate-800">
                  {selectedPoster.fileName}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatFileSize(selectedPoster.fileSize)}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void downloadPoster(selectedPoster)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
                >
                  <Download size={16} /> Download file
                </button>
                <button
                  type="button"
                  onClick={() => void deleteOneSubmission(selectedPoster)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 px-5 py-3 text-sm font-bold text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={16} /> Delete submission
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
