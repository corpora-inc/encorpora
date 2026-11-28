/** Photos live in IndexedDB (they are too big for localStorage), keyed by id, one database per app. */
import { logError } from "./log.ts";
import { namespace } from "./namespace.ts";

const STORE = "photos";
/** "crane-photos" for crane (the name it has always used), "maint-photos" for maint. */
const dbName = () => `${namespace().replace(/\.$/, "")}-photos`;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName(), 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

export async function savePhoto(id: string, blob: Blob): Promise<void> {
  await tx("readwrite", (s) => s.put(blob, id));
}

export async function loadPhoto(id: string): Promise<Blob | null> {
  try {
    return ((await tx("readonly", (s) => s.get(id))) as Blob | undefined) ?? null;
  } catch (e) {
    logError("photos.load", e);
    return null;
  }
}

export async function deletePhotos(ids: readonly string[]): Promise<void> {
  for (const id of ids) await tx("readwrite", (s) => s.delete(id));
}

/** Downscale a camera photo to at most `max` px on its long side, as JPEG. */
export async function shrinkImage(file: Blob, max = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode photo"))), "image/jpeg", 0.82));
}

/** The SHA-256 of a photo, hex: the id a record keeps so the photo can be checked later. */
export async function photoHash(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
