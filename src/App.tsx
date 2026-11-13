import { useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Keyboard, Navigation, Pagination } from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "./styles.css";

type Category = "newstories" | "beststories";

type News = {
  id: number;
  title: string;
  subtitle: string | null;
  date: string;
  keywords: string[];
  paragraphs: [string | null, string | null, string | null];
  sourceUrl: string;
  hnUrl: string;
  hasSourceText: boolean;
};

const categories: Record<Category, string> = {
  newstories: "Notícias Recentes",
  beststories: "Melhores Notícias",
};

const categoryDescriptions: Record<Category, string> = {
  newstories: "Acompanhe as publicações mais recentes da comunidade.",
  beststories: "Explore a seleção de melhores publicações do Hacker News.",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
});

export default function App() {
  const [category, setCategory] = useState<Category | null>(null);
  const [count, setCount] = useState(5);
  const [news, setNews] = useState<News[]>([]);
  const [screen, setScreen] = useState<"settings" | "news">("settings");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const controllerRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [screen]);

  async function loadNews() {
  if (!category || loading) return;

  controllerRef.current?.abort();

  const controller = new AbortController();
  controllerRef.current = controller;

  // Abre imediatamente a tela de notícias na mesma guia.
  setScreen("news");
  setNews([]);
  setError("");
  setLoading(true);

  try {
    const params = new URLSearchParams({
      category,
      count: String(count),
    });

    const response = await fetch(`/api/news?${params}`, {
      signal: controller.signal,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "Falha ao carregar notícias.");
    }

    if (!Array.isArray(result.news) || result.news.length === 0) {
      throw new Error("Nenhuma notícia disponível nesta consulta.");
    }

    setNews(result.news);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return;

    setError(
      error instanceof Error
        ? error.message
        : "Ocorreu um erro inesperado.",
    );
  } finally {
    setLoading(false);
  }
}

  if (screen === "news" && category) {
    return (
      <main className="app-shell">
        <div className="content-shell">
          <header className="page-header">
            <button
              type="button"
              className="button button--ghost"
              disabled={loading}
              onClick={() => setScreen("settings")}
            >
              <span aria-hidden="true">←</span> Voltar às opções
            </button>

            <h1 ref={headingRef} tabIndex={-1}>
              {categories[category]}
            </h1>

            {!loading && !error && news.length > 0 && (
              <p className="page-description">
                {news.length} notícias. Explore no seu ritmo, sem reprodução automática.
              </p>
            )}

            {!loading && !error && news.length > 0 && news.length < count && (
              <p className="notice" role="status">
                Foram encontradas menos publicações válidas que o solicitado.
              </p>
            )}
          </header>

          {loading && (
            <section
              className="feedback-panel"
              aria-labelledby="loading-title"
              aria-busy="true"
            >
              <h2 id="loading-title">Preparando suas notícias</h2>

              <p role="status">
                Consultando o Hacker News e processando os textos com llama3.1.
                Isso pode levar alguns minutos.
              </p>
            </section>
          )}

          {!loading && error && (
            <section className="feedback-panel" aria-labelledby="error-title">
              <h2 id="error-title">Não foi possível carregar as notícias</h2>

              <p className="error-message" role="alert">
                {error}
              </p>

              <button
                type="button"
                className="button button--primary"
                onClick={() => void loadNews()}
              >
                Tentar novamente
              </button>
            </section>
          )}

          {!loading && !error && news.length > 0 && (
            <section className="news-section" aria-label="Carrossel de notícias">
              <Swiper
                className="news-swiper"
                modules={[Navigation, Pagination, Keyboard, A11y]}
                slidesPerView={1}
                spaceBetween={32}
                navigation
                pagination={{ clickable: true }}
                keyboard={{ enabled: true, onlyInViewport: true }}
                autoHeight
                watchOverflow
                a11y={{
                  prevSlideMessage: "Notícia anterior",
                  nextSlideMessage: "Próxima notícia",
                  firstSlideMessage: "Esta é a primeira notícia",
                  lastSlideMessage: "Esta é a última notícia",
                  paginationBulletMessage: "Ir para a notícia {{index}}",
                }}
              >
                {news.map((article) => (
                  <SwiperSlide key={article.id}>
                    <article
                      className="news-card"
                      aria-labelledby={`title-${article.id}`}
                    >
                      <div className="news-card__content">
                        <header className="news-card__header">
                          <p className="news-date">
                            Publicada no Hacker News em{" "}
                            <time dateTime={article.date}>
                              {dateFormatter.format(new Date(article.date))}
                            </time>
                          </p>

                          <h2 id={`title-${article.id}`}>{article.title}</h2>

                          {article.subtitle && (
                            <p className="news-subtitle">{article.subtitle}</p>
                          )}
                        </header>

                        {article.keywords.length > 0 && (
                          <ul className="tags" aria-label="Palavras-chave">
                            {article.keywords.map((keyword, index) => (
                              <li className="tag" key={`${keyword}-${index}`}>
                                {keyword}
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="news-body">
                          {article.paragraphs[0] && (
                            <p>{article.paragraphs[0]}</p>
                          )}

                          {article.paragraphs[1] && (
                            <p>{article.paragraphs[1]}</p>
                          )}

                          {article.paragraphs[2] && (
                            <section className="main-point">
                              <h3>Ponto principal</h3>
                              <p>{article.paragraphs[2]}</p>
                            </section>
                          )}
                        </div>

                        {!article.hasSourceText && (
                          <p className="notice">
                            A API disponibilizou apenas o título e o link.
                            Não foi gerado um resumo da matéria completa.
                          </p>
                        )}

                        {article.hasSourceText &&
                          article.paragraphs.some((paragraph) => !paragraph) && (
                            <p className="notice">
                              O conteúdo disponível não permitiu preencher todas
                              as partes do resumo com segurança.
                            </p>
                          )}

                        <footer className="news-footer">
                          <div className="news-links">
                            <a
                              className="text-link"
                              href={article.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Ler publicação <span aria-hidden="true">↗</span>
                            </a>

                            <a
                              className="text-link"
                              href={article.hnUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Discussão no Hacker News
                            </a>
                          </div>

                          <p className="disclaimer">
                            Texto processado localmente por IA. Confira a fonte
                            original.
                          </p>
                        </footer>
                      </div>

                      <div
                        className="news-card__media"
                        aria-hidden="true"
                      />
                    </article>
                  </SwiperSlide>
                ))}
              </Swiper>
            </section>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="content-shell settings-shell">
       <header className="page-header">
        <h1 ref={headingRef} tabIndex={-1}>
          Escolha suas notícias
        </h1>
      </header>

        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            void loadNews();
          }}
          aria-busy={loading}
        >
          <fieldset className="form-fieldset" disabled={loading}>
            <legend>01 — Escolha uma categoria</legend>

            <div className="category-grid">
              {(Object.entries(categories) as [Category, string][]).map(
                ([value, label]) => (
                  <label className="category-option" key={value}>
                    <input
                      type="radio"
                      name="category"
                      value={value}
                      checked={category === value}
                      onChange={() => setCategory(value)}
                      required
                    />

                    <span className="category-card">
                      <span className="category-card__top">
                        <span className="category-card__title">{label}</span>
                        <span
                          className="category-card__indicator"
                          aria-hidden="true"
                        />
                      </span>

                      <span className="category-card__description">
                        {categoryDescriptions[value]}
                      </span>
                    </span>
                  </label>
                ),
              )}
            </div>
          </fieldset>

          {category && (
            <fieldset className="form-fieldset" disabled={loading}>
              <legend>02 — Quantas notícias você quer ver?</legend>

              <div className="quantity-control">
                <label htmlFor="count">Quantidade de notícias</label>

                <select
                  id="count"
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                >
                  {[1, 5, 10, 15, 20].map((value) => (
                    <option key={value} value={value}>
                      {value} {value === 1 ? "notícia" : "notícias"}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>
          )}

          <div className="form-actions">
            <button
              className="button button--primary"
              type="submit"
              disabled={!category || loading}
            >
              Explorar notícias
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}