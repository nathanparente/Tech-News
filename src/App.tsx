import { useCallback, useEffect, useRef, useState } from "react";
import type {
  HealthReport,
  ItemError,
  News,
  NewsCategory,
  NewsStreamDone,
  NewsStreamMeta,
} from "../shared/types.ts";
import ExportNewsButton from "./components/ExportNewsButton";
import NewsCarousel, { type Slide } from "./components/NewsCarousel";
import QueryForm from "./components/QueryForm";
import { readServerSentEvents } from "./parseSse";

import "./styles.css";

type StreamProgress = {
  completed: number;
  total: number | null;
};

function isNews(value: unknown): value is News {
  if (!value || typeof value !== "object") return false;

  const article = value as News;

  return (
    typeof article.id === "string" &&
    typeof article.title === "string" &&
    typeof article.sourceUrl === "string" &&
    typeof article.sourceName === "string" &&
    typeof article.date === "string" &&
    typeof article.hasSourceText === "boolean" &&
    (article.subtitle === null || typeof article.subtitle === "string") &&
    (article.imageUrl === null || typeof article.imageUrl === "string") &&
    Array.isArray(article.keywords) &&
    Array.isArray(article.paragraphs) &&
    article.paragraphs.length === 3
  );
}

function isItemError(value: unknown): value is ItemError {
  if (!value || typeof value !== "object") return false;

  const item = value as ItemError;

  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.sourceName === "string" &&
    typeof item.sourceUrl === "string" &&
    typeof item.message === "string"
  );
}

function isMeta(value: unknown): value is NewsStreamMeta {
  if (!value || typeof value !== "object") return false;

  const meta = value as { total: unknown; requested: unknown };

  return typeof meta.total === "number" && typeof meta.requested === "number";
}

function isDone(value: unknown): value is NewsStreamDone {
  if (!value || typeof value !== "object") return false;

  const done = value as { delivered: unknown; failed: unknown };

  return (
    typeof done.delivered === "number" && typeof done.failed === "number"
  );
}

function isHealth(value: unknown): value is HealthReport {
  if (!value || typeof value !== "object") return false;

  const report = value as HealthReport;

  return (
    typeof report.ok === "boolean" &&
    (report.ollama === "up" || report.ollama === "down") &&
    typeof report.model === "string" &&
    report.model.length > 0 &&
    typeof report.modelReady === "boolean"
  );
}

// Retorna só os problemas. Com Ollama e modelo prontos, não há aviso.
function healthProblemFrom(report: HealthReport): string | null {
  if (report.ollama === "down") {
    return "O Ollama não está em execução.";
  }

  if (!report.ok || !report.modelReady) {
    return `O modelo ${report.model} não está baixado no Ollama.`;
  }

  return null;
}

const backendOffline = "O backend não está em execução.";

async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(backendOffline);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(backendOffline);
  }
}

function progressMessage(progress: StreamProgress): string {
  if (progress.total === null) {
    return "Consultando a GNews e preparando os resumos com llama3.1.";
  }

  if (progress.total === 0) {
    return "Nenhuma publicação encontrada nesta consulta.";
  }

  if (progress.completed === 0) {
    return `Gerando o resumo 1 de ${progress.total}.`;
  }

  return `Resumo ${progress.completed} de ${progress.total}.`;
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type HistoryView = {
  view?: "news" | "options";
};

export default function App() {
  const [category, setCategory] = useState<NewsCategory | null>(null);
  const [count, setCount] = useState(5);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [progress, setProgress] = useState<StreamProgress>({
    completed: 0,
    total: null,
  });
  const [screen, setScreen] = useState<"settings" | "news">("settings");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [healthNotice, setHealthNotice] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const controllerRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const hasNewsHistoryRef = useRef(false);
  const screenRef = useRef(screen);
  const startedAtRef = useRef(0);
  const returnToOptionsRef = useRef<() => void>(() => {});

  const successfulNews = slides.flatMap((slide) =>
    slide.type === "item" ? [slide.article] : [],
  );
  const hasItemError = slides.some((slide) => slide.type === "error");

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function checkHealth() {
      try {
        const response = await fetch("/api/health", {
          signal: controller.signal,
        });
        const payload = await readJsonResponse(response);

        if (!isHealth(payload)) {
          setHealthNotice(backendOffline);
          return;
        }

        setHealthNotice(healthProblemFrom(payload));
      } catch (caught) {
        if (controller.signal.aborted) return;

        if (caught instanceof TypeError) {
          setHealthNotice(backendOffline);
          return;
        }

        setHealthNotice(
          caught instanceof Error ? caught.message : backendOffline,
        );
      }
    }

    void checkHealth();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    screenRef.current = screen;
    headingRef.current?.focus();
  }, [screen]);

  useEffect(() => {
    if (!loading) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds(
        Math.floor((Date.now() - startedAtRef.current) / 1000),
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [loading]);

  const returnToOptions = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    hasNewsHistoryRef.current = false;
    setScreen("settings");
    setLoading(false);
    setError("");
    setElapsedSeconds(0);
  }, []);

  useEffect(() => {
    returnToOptionsRef.current = returnToOptions;
  }, [returnToOptions]);

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const view = (event.state as HistoryView | null)?.view;

      if (view === "news" && screenRef.current === "settings") {
        history.replaceState({ view: "options" }, "");
        return;
      }

      if (screenRef.current === "news") {
        returnToOptionsRef.current();
      }
    }

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function handleBack() {
    if (hasNewsHistoryRef.current) {
      history.back();
      return;
    }

    returnToOptions();
  }

  async function loadNews() {
    if (!category || loading) return;

    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;

    // Abre imediatamente a tela de notícias na mesma guia.
    setScreen("news");

    if (!hasNewsHistoryRef.current) {
      history.pushState({ view: "news" }, "");
      hasNewsHistoryRef.current = true;
    }

    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setSlides([]);
    setProgress({ completed: 0, total: null });
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

      if (!response.ok) {
        let message = "Não foi possível contactar o backend.";

        try {
          const result = (await readJsonResponse(response)) as {
            error?: unknown;
          };

          if (typeof result.error === "string" && result.error) {
            message = result.error;
          }
        } catch (caught) {
          message =
            caught instanceof Error ? caught.message : backendOffline;
        }

        throw new Error(message);
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("text/event-stream") || !response.body) {
        throw new Error("O backend não enviou o fluxo de notícias.");
      }

      let receivedDone = false;

      for await (const event of readServerSentEvents(
        response.body,
        controller.signal,
      )) {
        if (controller.signal.aborted) return;

        let payload: unknown;

        try {
          payload = JSON.parse(event.data);
        } catch {
          continue;
        }

        if (event.event === "meta" && isMeta(payload)) {
          setProgress({ completed: 0, total: payload.total });
          continue;
        }

        if (event.event === "item" && isNews(payload)) {
          setSlides((current) => [
            ...current,
            { type: "item", article: payload },
          ]);
          setProgress((current) => ({
            total: current.total,
            completed: current.completed + 1,
          }));
          continue;
        }

        if (event.event === "item-error" && isItemError(payload)) {
          setSlides((current) => [
            ...current,
            { type: "error", failure: payload },
          ]);
          setProgress((current) => ({
            total: current.total,
            completed: current.completed + 1,
          }));
          continue;
        }

        if (event.event === "done" && isDone(payload)) {
          receivedDone = true;

          if (payload.delivered === 0 && payload.failed === 0) {
            setError("Nenhuma notícia disponível nesta consulta.");
          }
        }
      }

      if (!receivedDone && !controller.signal.aborted) {
        setError("A conexão com o backend foi interrompida.");
      }
    } catch (caught) {
      if (controller.signal.aborted) return;

      if (caught instanceof TypeError) {
        setError(backendOffline);
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Ocorreu um erro inesperado.",
      );
    } finally {
      if (controllerRef.current === controller) {
        setLoading(false);
      }
    }
  }

  if (screen === "news" && category) {
    return (
      <main className="app-shell">
        <div className="content-shell">
          <header className="page-header news-page-header">
            <button
              type="button"
              className="back-arrow"
              onClick={handleBack}
              aria-label="Voltar às opções"
              title="Voltar às opções"
            >
              <span aria-hidden="true">←</span>
            </button>

            {!loading && successfulNews.length > 0 && (
              <ExportNewsButton news={successfulNews} />
            )}

            <h1 ref={headingRef} tabIndex={-1} className="sr-only">
              Notícias de tecnologia
            </h1>
          </header>

          {loading && slides.length === 0 && (
            <>
            <section
              className="feedback-panel loading-panel"
              aria-labelledby="loading-title"
              aria-busy="true"
            >
              <span className="loading-spinner" aria-hidden="true" />

              <h2 id="loading-title">Preparando suas notícias</h2>

              <p role="status">
                {progressMessage(progress)}
                <br />
                Isso pode levar alguns minutos.
              </p>

              <p className="loading-elapsed">
                Gerando há {formatElapsed(elapsedSeconds)}.
              </p>
            </section>

            <div className="loading-skeleton" aria-hidden="true">
              <div className="loading-skeleton__copy">
                <span className="loading-skeleton__line loading-skeleton__line--short" />
                <span className="loading-skeleton__line loading-skeleton__line--title" />
                <span className="loading-skeleton__line" />
                <span className="loading-skeleton__line" />
                <span className="loading-skeleton__line loading-skeleton__line--medium" />
              </div>
              <span className="loading-skeleton__media" />
            </div>
            </>
          )}

          {loading && slides.length > 0 && (
            <p className="notice stream-status" role="status">
              {progressMessage(progress)}{" "}
              <span className="loading-elapsed">
                Gerando há {formatElapsed(elapsedSeconds)}.
              </span>
            </p>
          )}

          {!loading &&
            !error &&
            progress.total !== null &&
            progress.total < count &&
            slides.length > 0 && (
              <p className="notice stream-status" role="status">
                Foram encontradas menos publicações válidas que o solicitado.
              </p>
            )}

          {!loading && error && slides.length === 0 && (
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

          {!loading && error && slides.length > 0 && (
            <p className="error-message stream-status" role="alert">
              {error}
            </p>
          )}

          {!loading && hasItemError && (
            <div className="form-actions stream-status">
              <button
                type="button"
                className="button button--primary"
                onClick={() => void loadNews()}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {slides.length > 0 && <NewsCarousel slides={slides} />}
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

        {healthNotice && (
          <p className="error-message health-status" role="alert">
            {healthNotice}
          </p>
        )}

        <QueryForm
          category={category}
          count={count}
          loading={loading}
          onCategoryChange={setCategory}
          onCountChange={setCount}
          onSubmit={() => void loadNews()}
        />
      </div>
    </main>
  );
}
