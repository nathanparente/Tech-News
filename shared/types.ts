export type NewsCategory = "latest" | "headlines";

export type NewsSummary = {
  title: string;
  subtitle: string | null;
  keywords: string[];
  paragraphs: [string | null, string | null, string | null];
};

export type News = NewsSummary & {
  id: string;
  date: string;
  sourceUrl: string;
  sourceName: string;
  imageUrl: string | null;
  hasSourceText: boolean;
};

export type ItemError = {
  id: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  message: string;
};

export type HealthReport = {
  ok: boolean;
  ollama: "up" | "down";
  model: string;
  modelReady: boolean;
};

export type NewsStreamMeta = {
  total: number;
  requested: number;
};

export type NewsStreamDone = {
  delivered: number;
  failed: number;
};

export type NewsStreamEvent =
  | { event: "meta"; data: NewsStreamMeta }
  | { event: "item"; data: News }
  | { event: "item-error"; data: ItemError }
  | { event: "done"; data: NewsStreamDone };
