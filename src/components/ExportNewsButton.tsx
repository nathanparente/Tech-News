import { useState } from "react";
import {
  Document,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";

export type ExportableNews = {
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

type PreparedNews = ExportableNews & {
  pdfImage: string | null;
};

const colors = {
  background: "#002838",
  surface: "#001D38",
  accent: "#00DC7C",
  text: "#FFFFFF",
  tagBorder: "#E1FF9A",
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: colors.background,
    fontFamily: "Helvetica",
    color: colors.text,
  },

  card: {
    flex: 1,
    flexDirection: "row",
    padding: 28,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },

  content: {
    width: "66%",
    paddingRight: 32,
  },

  media: {
    width: "34%",
    height: 330,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },

  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  date: {
    marginBottom: 12,
    fontSize: 10,
    lineHeight: 1.4,
  },

  title: {
    marginBottom: 12,
    color: colors.accent,
    fontFamily: "Helvetica-Bold",
    fontSize: 24,
    lineHeight: 1.15,
  },

  subtitle: {
    marginBottom: 14,
    fontSize: 17,
    lineHeight: 1.3,
  },

  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
  },

  tag: {
    marginRight: 6,
    marginBottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.tagBorder,
    borderRadius: 12,
    backgroundColor: "rgba(0, 220, 124, 0.1)",
    color: colors.accent,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },

  paragraph: {
    marginBottom: 12,
    lineHeight: 1.4,
  },

  mainPoint: {
    marginBottom: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    backgroundColor: colors.surface,
  },

  notice: {
    marginBottom: 12,
    fontSize: 10,
    lineHeight: 1.4,
  },

  link: {
    marginTop: 4,
    color: colors.accent,
    fontSize: 11,
    textDecoration: "underline",
  },

  disclaimer: {
    marginTop: 12,
    fontSize: 9,
    lineHeight: 1.4,
  },

  pageNumber: {
    position: "absolute",
    right: 34,
    bottom: 12,
    fontSize: 9,
    color: colors.text,
  },
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
});

function bodyFontSize(article: ExportableNews): number {
  const length = [
    article.title,
    article.subtitle ?? "",
    ...article.paragraphs.map((paragraph) => paragraph ?? ""),
  ].join(" ").length;

  if (length > 4000) return 10;
  if (length > 2800) return 11;

  return 12;
}

/**
 * Busca somente a imagem já informada pela API.
 * Não consulta a GNews e não acessa o corpo da matéria.
 *
 * Se CORS, formato ou disponibilidade impedirem o download,
 * a página será exportada com placeholder.
 */
async function prepareImage(url: string | null): Promise<string | null> {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    const response = await fetch(parsed.href, {
      signal: AbortSignal.timeout(10_000),
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });

    if (!response.ok) return null;

    const blob = await response.blob();

    // PNG e JPEG são aceitos diretamente pelo renderizador.
    if (!["image/png", "image/jpeg"].includes(blob.type)) {
      return null;
    }

    if (blob.size > 5 * 1024 * 1024) {
      return null;
    }

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(
          typeof reader.result === "string" ? reader.result : null,
        );
      };

      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function NewsDocument({ news }: { news: PreparedNews[] }) {
  return (
    <Document
      title="Tech News — Notícias de tecnologia"
      author="Tech News"
      subject="Resumos de notícias gerados localmente com Ollama"
      language="pt-BR"
    >
      {news.map((article, index) => {
        const fontSize = bodyFontSize(article);

        return (
          <Page
            key={article.id}
            size="A3"
            orientation="landscape"
            style={styles.page}
            wrap={false}
          >
            <View style={styles.card}>
              <View style={styles.content}>
                <Text style={styles.date}>
                  {article.sourceName} · Publicada em{" "}
                  {dateFormatter.format(new Date(article.date))}
                </Text>

                <Text style={styles.title}>{article.title}</Text>

                {article.subtitle && (
                  <Text style={styles.subtitle}>
                    {article.subtitle}
                  </Text>
                )}

                <View style={styles.tags}>
                  {article.keywords.map((keyword, keywordIndex) => (
                    <Text
                      key={`${keyword}-${keywordIndex}`}
                      style={styles.tag}
                    >
                      {keyword}
                    </Text>
                  ))}
                </View>

                {article.paragraphs[0] && (
                  <Text style={[styles.paragraph, { fontSize }]}>
                    {article.paragraphs[0]}
                  </Text>
                )}

                {article.paragraphs[1] && (
                  <Text style={[styles.paragraph, { fontSize }]}>
                    {article.paragraphs[1]}
                  </Text>
                )}

                {article.paragraphs[2] && (
                  <View style={styles.mainPoint}>
                    <Text style={{ fontSize, lineHeight: 1.4 }}>
                      {article.paragraphs[2]}
                    </Text>
                  </View>
                )}

                {!article.hasSourceText && (
                  <Text style={styles.notice}>
                    A API não disponibilizou texto suficiente para
                    gerar um resumo da matéria.
                  </Text>
                )}

                <Link src={article.sourceUrl} style={styles.link}>
                  Ler publicação original
                </Link>

                <Text style={styles.disclaimer}>
                  Resumo por IA baseado no conteúdo disponibilizado
                  pela GNews, que pode estar incompleto. Confira a
                  fonte original.
                </Text>
              </View>

              <View style={styles.media}>
                {article.pdfImage && (
                  <Image
                    src={article.pdfImage}
                    style={styles.image}
                  />
                )}
              </View>
            </View>

            <Text style={styles.pageNumber}>
              {index + 1} / {news.length}
            </Text>
          </Page>
        );
      })}
    </Document>
  );
}

export default function ExportNewsButton({
  news,
}: {
  news: ExportableNews[];
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function exportPdf() {
    if (exporting || news.length === 0) return;

    setExporting(true);
    setError("");

    try {
      const prepared: PreparedNews[] = [];

      // Sequencial para evitar vários downloads simultâneos.
      for (const article of news) {
        prepared.push({
          ...article,
          pdfImage: await prepareImage(article.imageUrl),
        });
      }

      const blob = await pdf(
        <NewsDocument news={prepared} />,
      ).toBlob();

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download =
        `tech-news-${new Date().toISOString().slice(0, 10)}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      // Aguarda o navegador iniciar o download antes de liberar a URL.
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 60_000);
    } catch {
      setError(
        "Não foi possível gerar o PDF. Tente novamente.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="pdf-export" aria-busy={exporting}>
      <button
        type="button"
        className="button button--ghost"
        disabled={exporting || news.length === 0}
        onClick={() => void exportPdf()}
      >
        {exporting ? "Gerando PDF…" : "Exportar notícias em PDF"}
      </button>

      {exporting && (
        <p className="pdf-export__status" role="status">
          Preparando o documento e as imagens disponíveis…
        </p>
      )}

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}