import type { Response } from "express";
import type { News } from "../../shared/types.ts";

export function beginSse(res: Response) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}

export function writeEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function replayCachedNews(
  res: Response,
  news: News[],
  requested: number,
) {
  beginSse(res);
  writeEvent(res, "meta", { total: news.length, requested });

  for (const item of news) {
    if (res.writableEnded) return;

    writeEvent(res, "item", item);
  }

  if (!res.writableEnded) {
    writeEvent(res, "done", { delivered: news.length, failed: 0 });
    res.end();
  }
}
