import { z } from "zod";
import { safeUrl } from "./lib/security.ts";

export const MAX_NEWS = 10;

export const categorySchema = z.enum(["latest", "headlines"]);

export const newsQuerySchema = z.object({
  category: categorySchema,
  count: z.coerce.number().int().min(1).max(MAX_NEWS),
});

export const articleSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullish(),
  content: z.string().nullish(),
  url: z.string().refine((value) => safeUrl(value) !== null),
  image: z.string().nullish(),
  publishedAt: z.string().datetime({ offset: true }),
  source: z.object({
    name: z.string(),
    url: z.string().optional(),
  }),
});

export type Article = z.infer<typeof articleSchema>;

export const gnewsEnvelopeSchema = z.object({
  articles: z.array(z.unknown()),
});

export const summarySchema = z.object({
  title: z.string().min(1).max(300),
  subtitle: z.string().max(500).nullable(),
  keywords: z.array(z.string().min(1).max(60)).max(4),
  paragraphs: z.tuple([
    z.string().max(1500).nullable(),
    z.string().max(1500).nullable(),
    z.string().max(1500).nullable(),
  ]),
});

export type Summary = z.infer<typeof summarySchema>;

export const ollamaChatSchema = z.object({
  message: z.object({
    content: z.string(),
  }),
});

export const outputFormat = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    subtitle: { type: ["string", "null"] },
    keywords: {
      type: "array",
      maxItems: 4,
      items: { type: "string" },
    },
    paragraphs: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: ["string", "null"] },
    },
  },
  required: ["title", "subtitle", "keywords", "paragraphs"],
};

export const ollamaTagsSchema = z.object({
  models: z
    .array(
      z.object({
        name: z.string().optional(),
        model: z.string().optional(),
      }),
    )
    .optional(),
});

export const imageProxyQuerySchema = z.object({
  url: z.string().min(1).max(2_000),
});
