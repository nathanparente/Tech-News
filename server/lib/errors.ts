import { z } from "zod";
import { ServiceError } from "./http.ts";

export function errorDetails(error: unknown) {
  const cause =
    error instanceof Error
      ? (error.cause as { code?: string } | undefined)
      : undefined;

  // Não registra URL, chave, corpo ou o erro bruto.
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    service: error instanceof ServiceError ? error.service : undefined,
    status: error instanceof ServiceError ? error.status : undefined,
    causeCode: cause?.code,
  };
}

export function publicError(error: unknown): {
  status: number;
  message: string;
} {
  const details = errorDetails(error);

  const certificateErrors = new Set([
    "SELF_SIGNED_CERT_IN_CHAIN",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "CERT_HAS_EXPIRED",
  ]);

  if (
    details.causeCode &&
    certificateErrors.has(details.causeCode)
  ) {
    return {
      status: 502,
      message:
        "Não foi possível validar o certificado HTTPS. " +
        "Verifique a configuração de certificados do Node.js.",
    };
  }

  if (error instanceof ServiceError && error.service === "gnews") {
    if (error.status === 401) {
      return {
        status: 502,
        message:
          "A GNews recusou a autenticação. Confira GNEWS_API_KEY no backend.",
      };
    }

    if (error.status === 403) {
      return {
        status: 502,
        message:
          "A GNews negou o acesso. Confira a chave, a cota e as permissões do plano.",
      };
    }

    if (error.status === 429) {
      return {
        status: 503,
        message:
          "O limite de consultas da GNews foi atingido. Tente novamente mais tarde.",
      };
    }

    return {
      status: 502,
      message:
        "A GNews não conseguiu atender à consulta. Verifique o plano e tente novamente.",
    };
  }

  return {
    status: 502,
    message:
      "Não foi possível preparar as notícias. Verifique a conexão, " +
      "o Ollama e a instalação do modelo llama3.1.",
  };
}

export function itemErrorMessage(error: unknown): string {
  if (error instanceof SyntaxError || error instanceof z.ZodError) {
    return "O resumo desta notícia veio em formato inválido.";
  }

  return publicError(error).message;
}
