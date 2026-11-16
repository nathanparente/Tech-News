import type { NewsCategory } from "../../shared/types.ts";
import { GNEWS_KEY, GNEWS_URL, LANGUAGE } from "../config.ts";
import { fetchJson } from "../lib/http.ts";
import { getCached, setCached } from "../lib/memory-cache.ts";
import { safeUrl } from "../lib/security.ts";
import {
  articleSchema,
  gnewsEnvelopeSchema,
  MAX_NEWS,
  type Article,
} from "../schemas.ts";

export async function getArticles(
  category: NewsCategory,
  signal?: AbortSignal,
): Promise<Article[]> {
  const cacheKey = `gnews:${LANGUAGE}:${category}`;
  const cached = getCached<Article[]>(cacheKey);

  if (cached) return cached;

  const endpoint =
    category === "latest" ? "search" : "top-headlines";

  const url = new URL(`${GNEWS_URL}/${endpoint}`);

  url.searchParams.set("apikey", GNEWS_KEY);
  url.searchParams.set("lang", LANGUAGE);
  url.searchParams.set("max", String(MAX_NEWS));

  if (category === "latest") {
    // Busca temática, não uma taxonomia formal de categorias.
    url.searchParams.set(
      "q",
      LANGUAGE === "pt"
        ? 'tecnologia OR "inteligência artificial" OR software OR hardware'
        : 'technology OR "artificial intelligence" OR software OR hardware',
    );

    url.searchParams.set("sortby", "publishedAt");
  } else {
    url.searchParams.set("category", "technology");
  }

  const raw = await fetchJson(
    "gnews",
    url.toString(),
    20_000,
    {},
    signal,
  );

  const envelope = gnewsEnvelopeSchema.parse(raw);

  const articles: Article[] = [];
  const seenUrls = new Set<string>();

  for (const candidate of envelope.articles) {
    const parsed = articleSchema.safeParse(candidate);

    // Um item inválido não invalida toda a resposta.
    if (!parsed.success) continue;

    const sourceUrl = safeUrl(parsed.data.url);

    if (!sourceUrl || seenUrls.has(sourceUrl)) continue;

    seenUrls.add(sourceUrl);

    articles.push({
      ...parsed.data,
      url: sourceUrl,
    });
  }

  setCached(cacheKey, articles, 5 * 60_000);

  return articles;
}
