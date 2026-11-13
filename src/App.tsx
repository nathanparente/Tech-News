import { useEffect, useRef, useState, useId } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Keyboard, Navigation, Pagination } from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "./styles.css";

type Category = "latest" | "headlines";

type News = {
  id: string;
  title: string;
  subtitle: string | null;
  date: string;
  keywords: string[];
  paragraphs: [string | null, string | null, string | null];
  sourceUrl: string;
  sourceName: string;
  imageUrl: string | null;
  hasSourceText: boolean;
};

const categories: Record<Category, string> = {
  latest: "Últimas de tecnologia",
  headlines: "Destaques de tecnologia",
};

const categoryDescriptions: Record<Category, string> = {
  latest:
    "Notícias sobre tecnologia, ordenadas da mais recente para a mais antiga.",
  headlines:
    "Manchetes da categoria de tecnologia selecionadas pela GNews.",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
});

function NewsImage({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="news-card__media" aria-hidden="true">
      {src && !failed && (
        <img
          className="news-card__image"
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

const quantityOptions = [1, 5, 10];

type QuantitySelectProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

function QuantitySelect({
  value,
  onChange,
  disabled = false,
}: QuantitySelectProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = Math.max(0, quantityOptions.indexOf(value));

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      optionRefs.current[selectedIndex]?.focus();
    }
  }, [open, selectedIndex]);

  function closeAndFocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function selectOption(option: number) {
    onChange(option);
    closeAndFocus();
  }

  return (
    <div
      className="custom-select"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <span id={`${id}-label`} className="custom-select__label">
        Quantidade de notícias
      </span>

      <button
        ref={triggerRef}
        id={`${id}-trigger`}
        type="button"
        className="custom-select__trigger"
        disabled={disabled}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-listbox` : undefined}
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }

          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <span id={`${id}-value`}>
          {value} {value === 1 ? "notícia" : "notícias"}
        </span>

        <span
          className={`custom-select__chevron ${open ? "is-open" : ""}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          id={`${id}-listbox`}
          className="custom-select__dropdown"
          role="listbox"
          aria-labelledby={`${id}-label`}
        >
          {quantityOptions.map((option, index) => (
            <button
              key={option}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={value === option}
              tabIndex={-1}
              className="custom-select__option"
              onClick={() => selectOption(option)}
              onKeyDown={(event) => {
                let targetIndex: number | undefined;

                switch (event.key) {
                  case "ArrowDown":
                    targetIndex = (index + 1) % quantityOptions.length;
                    break;

                  case "ArrowUp":
                    targetIndex =
                      (index - 1 + quantityOptions.length) %
                      quantityOptions.length;
                    break;

                  case "Home":
                    targetIndex = 0;
                    break;

                  case "End":
                    targetIndex = quantityOptions.length - 1;
                    break;

                  case "Escape":
                    event.preventDefault();
                    closeAndFocus();
                    return;

                  case "Tab":
                    // Retorna ao botão antes da navegação padrão por Tab.
                    setOpen(false);
                    triggerRef.current?.focus();
                    return;
                }

                if (targetIndex !== undefined) {
                  event.preventDefault();
                  optionRefs.current[targetIndex]?.focus();
                }
              }}
            >
              <span>
                {option} {option === 1 ? "notícia" : "notícias"}
              </span>

              {value === option && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
          <header className="page-header news-page-header">
            {!loading && (
              <button
                type="button"
                className="back-arrow"
                onClick={() => setScreen("settings")}
                aria-label="Voltar às opções"
                title="Voltar às opções"
              >
                <span aria-hidden="true">←</span>
              </button>
            )}

            <h1 ref={headingRef} tabIndex={-1} className="sr-only">
              Notícias de tecnologia
            </h1>

            {!loading && !error && news.length > 0 && news.length < count && (
              <p className="notice" role="status">
                Foram encontradas menos publicações válidas que o solicitado.
              </p>
            )}
          </header>

          {loading && (
            <section
              className="feedback-panel loading-panel"
              aria-labelledby="loading-title"
              aria-busy="true"
            >
              <span className="loading-spinner" aria-hidden="true" />

              <h2 id="loading-title">Preparando suas notícias</h2>

              <p role="status">
                Consultando a GNews e processando os textos com llama3.1.
                <br />
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
                            {article.sourceName} · Publicada em{" "}
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
                            <div className="main-point">
                              <p>{article.paragraphs[2]}</p>
                            </div>
                          )}
                        </div>

                        {!article.hasSourceText && (
                          <p className="notice">
                            A GNews disponibilizou apenas o título e os dados da publicação.
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
                              Ler publicação original
                              <span aria-hidden="true"> ↗</span>
                            </a>
                          </div>
                        </footer>
                      </div>

                      <NewsImage
                        key={article.imageUrl ?? "no-image"}
                        src={article.imageUrl}
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
          Tech News - Acompanhe notícias do mundo da tecnologia
        </h1>
        <p>Integrado com a API GNews para exibir notícias atualizadas</p>
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
              <legend className="sr-only">Quantidade de notícias</legend>

              <QuantitySelect
                value={count}
                onChange={setCount}
                disabled={loading}
              />
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