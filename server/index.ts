import { createHash } from "node:crypto";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import type { News, NewsSummary } from "../shared/types.ts";
import { LANGUAGE, MODEL, ORIGIN, PORT } from "./config.ts";
import {
  errorDetails,
  itemErrorMessage,
  publicError,
} from "./lib/errors.ts";
import { getCached, setCached } from "./lib/memory-cache.ts";
import { plainText, safeUrl } from "./lib/security.ts";
import { beginSse, replayCachedNews, writeEvent } from "./lib/sse.ts";
import { newsQuerySchema, summarySchema } from "./schemas.ts";
import { getArticles } from "./services/gnews.ts";
import {
  fetchImageAsJpeg,
  parseImageTarget,
} from "./services/image-proxy.ts";
import {
  checkOllama,
  PROMPT_HASH,
  summarize,
} from "./services/ollama.ts";
import {
  buildSummaryKey,
  deleteSummary,
  getSummary,
  setSummary,
  SUMMARY_TTL_MS,
} from "./summary-cache.ts";

const app = express();

app.disable("x-powered-by");

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && origin !== ORIGIN) {
    res.status(403).json({ error: "Origem não permitida." });
    return;
  }

  next();
});

app.use(cors({ origin: ORIGIN }));

app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);

function articleId(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

// Uma geração por vez para não sobrecarregar o Ollama local.
let generationRunning = false;

app.get("/api/news", async (req, res) => {
  const query = newsQuerySchema.safeParse(req.query);

  if (!query.success) {
    res.status(400).json({
      error:
        "Informe uma categoria válida e uma quantidade entre 1 e 10.",
    });
    return;
  }

  const { category, count } = query.data;

  const listKey =
    `list:${MODEL}:${PROMPT_HASH}:${LANGUAGE}:${category}:${count}`;

  const cached = getCached<News[]>(listKey);

  if (cached) {
    try {
      replayCachedNews(res, cached, count);
    } catch (error) {
      console.error("[GET /api/news]", errorDetails(error));

      if (!res.headersSent) {
        res.status(502).json({
          error: "Não foi possível preparar as notícias.",
        });
      } else if (!res.writableEnded) {
        res.end();
      }
    }

    return;
  }

  if (generationRunning) {
    res.status(429).json({
      error:
        "Há uma geração em andamento. Aguarde e tente novamente.",
    });
    return;
  }

  generationRunning = true;

  const clientAbort = new AbortController();
  let streamClosed = false;

  const onClose = () => {
    if (!streamClosed) clientAbort.abort();
  };

  res.on("close", onClose);

  try {
    const articles = await getArticles(category, clientAbort.signal);

    if (clientAbort.signal.aborted || res.writableEnded) return;

    beginSse(res);

    const selected = articles.slice(0, count);
    const news: News[] = [];
    let failed = 0;

    writeEvent(res, "meta", {
      total: selected.length,
      requested: count,
    });

    for (const article of selected) {
      if (clientAbort.signal.aborted) break;

      const id = articleId(article.url);
      const title = plainText(article.title).slice(0, 500);
      const description = plainText(article.description ?? "");
      const content = plainText(article.content ?? "");
      const sourceName = plainText(article.source.name);

      try {
        const summaryKey = buildSummaryKey(MODEL, PROMPT_HASH, id, {
          title,
          description,
          content,
        });

        const stored = await getSummary<unknown>(summaryKey);
        const parsedStored = summarySchema.safeParse(stored);
        let summary: NewsSummary | undefined;

        if (stored !== undefined && parsedStored.success) {
          summary = parsedStored.data;
        } else if (stored !== undefined) {
          await deleteSummary(summaryKey);
        }

        if (!summary) {
          summary = await summarize(
            title,
            description,
            content,
            clientAbort.signal,
          );

          await setSummary(summaryKey, summary, SUMMARY_TTL_MS);
        }

        if (clientAbort.signal.aborted) break;

        const item: News = {
          ...summary,
          id,
          date: new Date(article.publishedAt).toISOString(),
          sourceUrl: article.url,
          sourceName,
          imageUrl: safeUrl(article.image),
          hasSourceText: Boolean(description || content),
        };

        news.push(item);
        writeEvent(res, "item", item);
      } catch (error) {
        if (clientAbort.signal.aborted) break;

        failed += 1;
        console.error("[GET /api/news]", errorDetails(error));

        writeEvent(res, "item-error", {
          id,
          title,
          sourceName,
          sourceUrl: article.url,
          message: itemErrorMessage(error),
        });
      }
    }

    if (!clientAbort.signal.aborted && !res.writableEnded) {
      writeEvent(res, "done", {
        delivered: news.length,
        failed,
      });

      if (failed === 0) {
        setCached(listKey, news, 5 * 60_000);
      }

      streamClosed = true;
      res.end();
    }
  } catch (error) {
    if (clientAbort.signal.aborted) return;

    console.error("[GET /api/news]", errorDetails(error));

    if (!res.headersSent) {
      const result = publicError(error);

      streamClosed = true;
      res.status(result.status).json({
        error: result.message,
      });
    } else if (!res.writableEnded) {
      streamClosed = true;
      res.end();
    }
  } finally {
    generationRunning = false;
    res.off("close", onClose);
  }
});

app.get("/api/image-proxy", async (req, res) => {
  const target = parseImageTarget(req.query);

  if (!target) {
    res.status(400).json({
      error: "Informe uma URL HTTP ou HTTPS pública.",
    });
    return;
  }

  try {
    const jpeg = await fetchImageAsJpeg(target);

    res.status(200);
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Length", String(jpeg.length));
    res.end(jpeg);
  } catch (error) {
    console.error(
      "[GET /api/image-proxy]",
      error instanceof Error ? error.name : "UnknownError",
    );

    if (!res.headersSent) {
      res.status(502).json({
        error: "Não foi possível obter a imagem.",
      });
    }
  }
});

app.get("/api/health", async (_req, res) => {
  const { status, report } = await checkOllama();

  res.status(status).json(report);
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Backend: http://127.0.0.1:${PORT}`);
});
