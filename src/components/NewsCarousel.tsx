import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Keyboard, Navigation, Pagination } from "swiper/modules";
import type { ItemError, News } from "../../shared/types.ts";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

export type Slide =
  | { type: "item"; article: News }
  | { type: "error"; failure: ItemError };

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

export default function NewsCarousel({ slides }: { slides: Slide[] }) {
  return (
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
        observer
        observeParents
        a11y={{
          prevSlideMessage: "Notícia anterior",
          nextSlideMessage: "Próxima notícia",
          firstSlideMessage: "Esta é a primeira notícia",
          lastSlideMessage: "Esta é a última notícia",
          paginationBulletMessage: "Ir para a notícia {{index}}",
        }}
      >
        {slides.map((slide) => {
          if (slide.type === "error") {
            return (
              <SwiperSlide key={slide.failure.id}>
                <article
                  className="news-card"
                  aria-labelledby={`title-${slide.failure.id}`}
                >
                  <div className="news-card__content">
                    <header className="news-card__header">
                      <p className="news-date">{slide.failure.sourceName}</p>

                      <h2 id={`title-${slide.failure.id}`}>
                        {slide.failure.title}
                      </h2>
                    </header>

                    <p className="error-message" role="alert">
                      {slide.failure.message}
                    </p>

                    <footer className="news-footer">
                      <div className="news-links">
                        <a
                          className="text-link"
                          href={slide.failure.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ler publicação original
                          <span aria-hidden="true"> ↗</span>
                        </a>
                      </div>
                    </footer>
                  </div>

                  <NewsImage src={null} />
                </article>
              </SwiperSlide>
            );
          }

          const article = slide.article;

          return (
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
          );
        })}
      </Swiper>
    </section>
  );
}
