import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_ENTRIES = 500;

export const SUMMARY_TTL_MS = 30 * 60_000;

const defaultCachePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "summaries.json",
);

type DiskEntry = {
  expiresAt: number;
  value: unknown;
};

type Store = Record<string, DiskEntry>;

type SummaryText = {
  title: string;
  description: string;
  content: string;
};

export function buildSummaryKey(
  model: string,
  promptHash: string,
  id: string,
  text: SummaryText,
): string {
  // Invalida o resumo se o material da publicação ou o prompt mudar.
  const revision = createHash("sha256")
    .update(
      JSON.stringify({
        title: text.title,
        description: text.description,
        content: text.content,
      }),
    )
    .digest("hex");

  return `summary:v3:${model}:${promptHash}:${id}:${revision}`;
}

function isEntry(value: unknown): value is DiskEntry {
  if (!value || typeof value !== "object") return false;

  const entry = value as DiskEntry;

  return typeof entry.expiresAt === "number" && "value" in entry;
}

export function prune(store: Store): Store {
  const now = Date.now();
  const fresh = Object.entries(store).filter(([, entry]) => {
    return isEntry(entry) && entry.expiresAt > now;
  });

  fresh.sort((left, right) => left[1].expiresAt - right[1].expiresAt);

  return Object.fromEntries(
    fresh.slice(Math.max(0, fresh.length - MAX_ENTRIES)),
  );
}

export function createSummaryCache(cachePath: string = defaultCachePath) {
  let memory: Store | null = null;
  let writeQueue: Promise<void> = Promise.resolve();

  async function load(): Promise<Store> {
    if (memory) return memory;

    try {
      const raw = await readFile(cachePath, "utf8");
      const parsed: unknown = JSON.parse(raw);

      memory =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? prune(parsed as Store)
          : {};
    } catch {
      memory = {};
    }

    return memory;
  }

  function enqueueWrite(snapshot: string): Promise<void> {
    const run = writeQueue.then(() => writeAtomic(snapshot));

    writeQueue = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  async function writeAtomic(snapshot: string): Promise<void> {
    const directory = path.dirname(cachePath);

    await mkdir(directory, { recursive: true });

    const tempPath = path.join(
      directory,
      `${path.basename(cachePath, ".json")}.${process.pid}.json.tmp`,
    );

    await writeFile(tempPath, snapshot, "utf8");
    await rename(tempPath, cachePath);
  }

  async function persist(store: Store): Promise<void> {
    memory = store;

    try {
      await enqueueWrite(JSON.stringify(store));
    } catch (error) {
      console.error(
        "[summary-cache]",
        error instanceof Error ? error.name : "UnknownError",
      );
    }
  }

  async function getSummary<T>(key: string): Promise<T | undefined> {
    const store = await load();
    const entry = store[key];

    if (!isEntry(entry)) return undefined;

    if (entry.expiresAt <= Date.now()) {
      delete store[key];
      await persist(store);
      return undefined;
    }

    return entry.value as T;
  }

  async function setSummary(
    key: string,
    value: unknown,
    ttlMs: number,
  ): Promise<void> {
    const store = await load();

    store[key] = {
      value,
      expiresAt: Date.now() + ttlMs,
    };

    await persist(prune(store));
  }

  async function deleteSummary(key: string): Promise<void> {
    const store = await load();

    if (!Object.prototype.hasOwnProperty.call(store, key)) return;

    delete store[key];
    await persist(store);
  }

  return { getSummary, setSummary, deleteSummary };
}

const defaultCache = createSummaryCache();

export const getSummary = defaultCache.getSummary;
export const setSummary = defaultCache.setSummary;
export const deleteSummary = defaultCache.deleteSummary;
