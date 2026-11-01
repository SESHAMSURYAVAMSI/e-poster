import { openDB, type DBSchema } from "idb";

export type CachedPoster = {
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
  offlineFileAvailable?: boolean;
};

export type QueuedSubmission = {
  id: string;
  fields: {
    authorName: string;
    email: string;
    institution: string;
    department: string;
    coAuthors: string;
    title: string;
    category: string;
    abstract: string;
    keywords: string;
  };
  file: File;
  createdAt: string;
  status: "pending";
};

interface EposterDB extends DBSchema {
  posters: {
    key: string;
    value: CachedPoster;
  };
  posterFiles: {
    key: string;
    value: { id: string; blob: Blob; fileName: string; fileType: string };
  };
  pendingSubmissions: {
    key: string;
    value: QueuedSubmission;
  };
}

const DB_NAME = "eposter-offline-v1";

function inferMimeType(fileName: string): string {
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

function database() {
  return openDB<EposterDB>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("posters")) {
        db.createObjectStore("posters", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("posterFiles")) {
        db.createObjectStore("posterFiles", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("pendingSubmissions")) {
        db.createObjectStore("pendingSubmissions", { keyPath: "id" });
      }
    },
  });
}

export async function cachePosters(posters: CachedPoster[]) {
  const db = await database();
  const tx = db.transaction("posters", "readwrite");
  for (const poster of posters) {
    await tx.store.put({ ...poster, offlineFileAvailable: undefined });
  }
  await tx.done;
}

export async function getCachedPosters(): Promise<CachedPoster[]> {
  const db = await database();
  return db.getAll("posters");
}

export async function cachePosterFile(
  id: string,
  blob: Blob,
  fileName: string,
  fileType: string,
) {
  const db = await database();
  await db.put("posterFiles", { id, blob, fileName, fileType });
}

export async function getCachedPosterFile(id: string) {
  const db = await database();
  return db.get("posterFiles", id);
}

export async function deleteCachedPoster(id: string) {
  const db = await database();
  const tx = db.transaction(["posters", "posterFiles"], "readwrite");
  await Promise.all([tx.objectStore("posters").delete(id), tx.objectStore("posterFiles").delete(id)]);
  await tx.done;
}

export async function deleteAllCachedPosters() {
  const db = await database();
  const tx = db.transaction(["posters", "posterFiles"], "readwrite");
  await Promise.all([tx.objectStore("posters").clear(), tx.objectStore("posterFiles").clear()]);
  await tx.done;
}

export async function queueSubmission(
  fields: QueuedSubmission["fields"],
  file: File,
): Promise<QueuedSubmission> {
  const db = await database();
  const queued: QueuedSubmission = {
    id: `offline-${crypto.randomUUID()}`,
    fields,
    file,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await db.put("pendingSubmissions", queued);
  return queued;
}

export async function getQueuedSubmissions(): Promise<QueuedSubmission[]> {
  const db = await database();
  return db.getAll("pendingSubmissions");
}

export async function syncQueuedSubmissions(): Promise<{
  synced: number;
  remaining: number;
  errors: string[];
}> {
  if (typeof navigator === "undefined" || !navigator.onLine) {
    return { synced: 0, remaining: (await getQueuedSubmissions()).length, errors: [] };
  }

  const db = await database();
  const queued = await db.getAll("pendingSubmissions");
  let synced = 0;
  const errors: string[] = [];

  for (const item of queued) {
    try {
      const formData = new FormData();
      Object.entries(item.fields).forEach(([key, value]) => {
        formData.append(key, String(value ?? ""));
      });
      formData.append("file", item.file, item.file.name);

      const response = await fetch("/api/submissions", {
        method: "POST",
        body: formData,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        errors.push(`${item.fields.title}: ${result?.error || "Upload failed"}`);
        continue;
      }

      const submission = result?.submission as CachedPoster | undefined;
      if (submission?.id) {
        // Keep the uploaded file available offline under its permanent cloud ID.
        await db.put("posters", submission);
        await db.put("posterFiles", {
          id: submission.id,
          blob: item.file,
          fileName: item.file.name,
          fileType: item.file.type && item.file.type !== "application/octet-stream"
            ? item.file.type
            : inferMimeType(item.file.name),
        });
      }
      await db.delete("pendingSubmissions", item.id);
      // Remove the temporary file key only after its permanent copy is saved.
      await db.delete("posterFiles", item.id);
      synced += 1;
    } catch {
      // Keep the item in IndexedDB so it can be retried after connectivity returns.
      errors.push(`${item.fields.title}: waiting for a connection`);
      break;
    }
  }

  return {
    synced,
    remaining: await db.count("pendingSubmissions"),
    errors,
  };
}
