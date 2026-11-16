import { describe, expect, it } from "vitest";
import {
  articleSchema,
  newsQuerySchema,
  summarySchema,
} from "./schemas.ts";

describe("newsQuerySchema", () => {
  it.each(["latest", "headlines"])("aceita a categoria %s", (category) => {
    expect(
      newsQuerySchema.safeParse({ category, count: "5" }).success,
    ).toBe(true);
  });

  it.each(["1", "10"])("aceita count %s", (count) => {
    const parsed = newsQuerySchema.safeParse({ category: "latest", count });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.count).toBe(Number(count));
  });

  it.each(["0", "11", "1.5", "abc"])("recusa count %s", (count) => {
    expect(
      newsQuerySchema.safeParse({ category: "latest", count }).success,
    ).toBe(false);
  });

  it("recusa categoria inválida", () => {
    expect(
      newsQuerySchema.safeParse({ category: "sports", count: "5" }).success,
    ).toBe(false);
  });
});

const article = {
  title: "Título",
  description: "Descrição",
  content: "Conteúdo",
  url: "https://example.com/noticia",
  image: "https://example.com/imagem.jpg",
  publishedAt: "2026-11-16T12:00:00Z",
  source: { name: "Fonte", url: "https://example.com" },
};

describe("articleSchema", () => {
  it("aceita o formato da GNews", () => {
    expect(articleSchema.safeParse(article).success).toBe(true);
  });

  it("aceita description, content e image ausentes", () => {
    expect(
      articleSchema.safeParse({
        ...article,
        description: null,
        content: undefined,
        image: null,
      }).success,
    ).toBe(true);
  });

  it("recusa item sem título", () => {
    expect(articleSchema.safeParse({ ...article, title: "" }).success).toBe(
      false,
    );
  });

  it("recusa item sem fonte", () => {
    const withoutSource: Record<string, unknown> = { ...article };

    delete withoutSource.source;

    expect(articleSchema.safeParse(withoutSource).success).toBe(false);
  });

  it("recusa data sem fuso válido", () => {
    expect(
      articleSchema.safeParse({ ...article, publishedAt: "ontem" }).success,
    ).toBe(false);
  });

  it.each([
    "javascript:alert(1)",
    "não é url",
    "https://user:pass@example.com/",
  ])("recusa a URL %s", (url) => {
    expect(articleSchema.safeParse({ ...article, url }).success).toBe(false);
  });
});

const summary = {
  title: "Resumo",
  subtitle: "Subtítulo",
  keywords: ["ia", "software"],
  paragraphs: ["Contexto", "Complemento", "Ponto principal"],
};

describe("summarySchema", () => {
  it("aceita o resumo completo", () => {
    expect(summarySchema.safeParse(summary).success).toBe(true);
  });

  it("aceita subtítulo e parágrafos nulos", () => {
    expect(
      summarySchema.safeParse({
        ...summary,
        subtitle: null,
        paragraphs: [null, null, null],
      }).success,
    ).toBe(true);
  });

  it("recusa mais de quatro palavras-chave", () => {
    expect(
      summarySchema.safeParse({
        ...summary,
        keywords: ["a", "b", "c", "d", "e"],
      }).success,
    ).toBe(false);
  });

  it("recusa menos de três parágrafos", () => {
    expect(
      summarySchema.safeParse({
        ...summary,
        paragraphs: ["Contexto", "Complemento"],
      }).success,
    ).toBe(false);
  });

  it.each(["title", "subtitle", "keywords", "paragraphs"])(
    "recusa resumo sem %s",
    (field) => {
      const incomplete: Record<string, unknown> = { ...summary };

      delete incomplete[field];

      expect(summarySchema.safeParse(incomplete).success).toBe(false);
    },
  );
});
