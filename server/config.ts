import "dotenv/config";
import { z } from "zod";

export const PORT = Number(process.env.PORT ?? 3001);
export const ORIGIN =
  process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:5173";

export const OLLAMA_URL =
  process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";

export const MODEL = process.env.OLLAMA_MODEL ?? "llama3.1";
export const GNEWS_URL = "https://gnews.io/api/v4";

export const LANGUAGE = z
  .enum(["pt", "en"])
  .parse(process.env.GNEWS_LANG ?? "pt");

const gnewsKey = process.env.GNEWS_API_KEY?.trim();

if (!gnewsKey) {
  throw new Error(
    "Configure GNEWS_API_KEY no .env antes de iniciar o backend.",
  );
}

export const GNEWS_KEY: string = gnewsKey;
