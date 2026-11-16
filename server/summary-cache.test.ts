import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSummaryKey,
  createSummaryCache,
  prune,
  SUMMARY_TTL_MS,
} from "./summary-cache.ts";

const text = {
  title: "Título",
  description: "Descrição",
  content: "Conteúdo",
};

let directory: string;
let cachePath: string;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
  directory = await mkdtemp(path.join(os.tmpdir(), "tech-news-cache-"));
  cachePath = path.join(directory, "summaries.json");
});

afterEach(async () => {
  vi.useRealTimers();
  await rm(directory, { recursive: true, force: true });
});

describe("buildSummaryKey", () => {
  it("segue o formato summary:v3", () => {
    expect(buildSummaryKey("llama3.1", "hash", "id", text)).toMatch(
      /^summary:v3:llama3\.1:hash:id:[0-9a-f]{64}$/,
    );
  });

  it("muda quando o hash do prompt muda", () => {
    expect(buildSummaryKey("llama3.1", "a", "id", text)).not.toBe(
      buildSummaryKey("llama3.1", "b", "id", text),
    );
  });

  it("muda quando o texto da notícia muda", () => {
    const original = buildSummaryKey("llama3.1", "hash", "id", text);

    expect(
      buildSummaryKey("llama3.1", "hash", "id", { ...text, title: "Outro" }),
    ).not.toBe(original);
    expect(
      buildSummaryKey("llama3.1", "hash", "id", {
        ...text,
        content: "Outro conteúdo",
      }),
    ).not.toBe(original);
  });

  it("é estável para o mesmo material", () => {
    expect(buildSummaryKey("llama3.1", "hash", "id", text)).toBe(
      buildSummaryKey("llama3.1", "hash", "id", { ...text }),
    );
  });
});

describe("createSummaryCache", () => {
  it("devolve undefined na falta e o valor no acerto", async () => {
    const cache = createSummaryCache(cachePath);

    expect(await cache.getSummary("chave")).toBeUndefined();

    await cache.setSummary("chave", { title: "Resumo" }, SUMMARY_TTL_MS);

    expect(await cache.getSummary("chave")).toEqual({ title: "Resumo" });
  });

  it("grava no disco e outra instância lê o mesmo arquivo", async () => {
    await createSummaryCache(cachePath).setSummary(
      "chave",
      "valor",
      SUMMARY_TTL_MS,
    );

    const stored = JSON.parse(await readFile(cachePath, "utf8"));

    expect(stored.chave.value).toBe("valor");
    expect(await createSummaryCache(cachePath).getSummary("chave")).toBe(
      "valor",
    );
  });

  it("não reaproveita o resumo de outro prompt", async () => {
    const cache = createSummaryCache(cachePath);
    const oldKey = buildSummaryKey("llama3.1", "prompt-a", "id", text);
    const newKey = buildSummaryKey("llama3.1", "prompt-b", "id", text);

    await cache.setSummary(oldKey, "antigo", SUMMARY_TTL_MS);

    expect(await cache.getSummary(newKey)).toBeUndefined();
  });

  it("expira depois de 30 minutos", async () => {
    const cache = createSummaryCache(cachePath);

    await cache.setSummary("chave", "valor", SUMMARY_TTL_MS);

    vi.advanceTimersByTime(SUMMARY_TTL_MS - 1);
    expect(await cache.getSummary("chave")).toBe("valor");

    vi.advanceTimersByTime(1);
    expect(await cache.getSummary("chave")).toBeUndefined();
  });

  it("descarta entradas vencidas ao carregar o arquivo", async () => {
    const now = Date.now();

    await writeFile(
      cachePath,
      JSON.stringify({
        vencida: { expiresAt: now - 1, value: "x" },
        valida: { expiresAt: now + 1_000, value: "y" },
      }),
    );

    const cache = createSummaryCache(cachePath);

    expect(await cache.getSummary("vencida")).toBeUndefined();
    expect(await cache.getSummary("valida")).toBe("y");
  });

  it("remove uma entrada com deleteSummary", async () => {
    const cache = createSummaryCache(cachePath);

    await cache.setSummary("chave", "valor", SUMMARY_TTL_MS);
    await cache.deleteSummary("chave");

    expect(await cache.getSummary("chave")).toBeUndefined();
  });

  it.each([
    ["vazio", ""],
    ["com JSON inválido", "{ nao e json"],
    ["com um array", "[]"],
  ])("recupera sem erro quando o arquivo está %s", async (_label, raw) => {
    await writeFile(cachePath, raw);

    const cache = createSummaryCache(cachePath);

    expect(await cache.getSummary("chave")).toBeUndefined();

    await cache.setSummary("chave", "valor", SUMMARY_TTL_MS);

    expect(await cache.getSummary("chave")).toBe("valor");
    expect(JSON.parse(await readFile(cachePath, "utf8")).chave.value).toBe(
      "valor",
    );
  });
});

describe("prune", () => {
  it("mantém no máximo 500 entradas, as de expiração mais distante", () => {
    const now = Date.now();
    const store = Object.fromEntries(
      Array.from({ length: 520 }, (_, index) => [
        `chave-${index}`,
        { expiresAt: now + 1_000 + index, value: index },
      ]),
    );

    const pruned = prune(store);
    const keys = Object.keys(pruned);

    expect(keys).toHaveLength(500);
    expect(keys).not.toContain("chave-0");
    expect(keys).not.toContain("chave-19");
    expect(keys).toContain("chave-20");
    expect(keys).toContain("chave-519");
  });

  it("descarta entradas vencidas e malformadas", () => {
    const now = Date.now();

    expect(
      prune({
        vencida: { expiresAt: now, value: 1 },
        valida: { expiresAt: now + 1, value: 2 },
        malformada: { value: 3 } as never,
      }),
    ).toEqual({ valida: { expiresAt: now + 1, value: 2 } });
  });

  it("aplica o teto também pela gravação", async () => {
    const cache = createSummaryCache(cachePath);

    for (let index = 0; index < 505; index += 1) {
      vi.advanceTimersByTime(1);
      await cache.setSummary(`chave-${index}`, index, SUMMARY_TTL_MS);
    }

    const stored = JSON.parse(await readFile(cachePath, "utf8"));

    expect(Object.keys(stored)).toHaveLength(500);
    expect(stored["chave-0"]).toBeUndefined();
    expect(stored["chave-504"].value).toBe(504);
  });
});
