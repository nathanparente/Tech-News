export class ServiceError extends Error {
  readonly service: "gnews" | "ollama";
  readonly status: number;

  constructor(service: "gnews" | "ollama", status: number) {
    super(`${service}: HTTP ${status}`);
    this.name = "ServiceError";
    this.service = service;
    this.status = status;
  }
}

export async function fetchJson(
  service: "gnews" | "ollama",
  url: string,
  timeout: number,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<unknown> {
  const timeoutSignal = AbortSignal.timeout(timeout);
  const combined = signal
    ? AbortSignal.any([timeoutSignal, signal])
    : timeoutSignal;

  const response = await fetch(url, {
    ...options,
    signal: combined,
    redirect: "error",
  });

  if (!response.ok) {
    throw new ServiceError(service, response.status);
  }

  return response.json();
}
