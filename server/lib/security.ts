import { convert } from "html-to-text";

export function plainText(value: string): string {
  return convert(value.slice(0, 100_000), {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
    ],
  }).trim();
}

export function safeUrl(value: string | null | undefined): string | null {
  try {
    const url = new URL(value ?? "");

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    if (url.username || url.password) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

export function isBlockedImageHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return isPrivateIPv4(host);
  }

  if (host.includes(":")) {
    return isPrivateIPv6(host);
  }

  return false;
}

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }

  const [first, second] = parts;

  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;

  return false;
}

function isPrivateIPv6(host: string): boolean {
  const address = host.split("%")[0];

  if (address === "::" || address === "::1") return true;

  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);

  if (dotted) return isPrivateIPv4(dotted[1]);

  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address);

  if (mapped) {
    const high = Number.parseInt(mapped[1], 16);
    const low = Number.parseInt(mapped[2], 16);
    const ipv4 = [
      (high >> 8) & 255,
      high & 255,
      (low >> 8) & 255,
      low & 255,
    ].join(".");

    return isPrivateIPv4(ipv4);
  }

  const firstText = address.startsWith(":") ? "0" : address.split(":")[0];
  const first = Number.parseInt(firstText, 16);

  if (!Number.isInteger(first)) return true;

  if (first >= 0xfe80 && first <= 0xfebf) return true;
  if (first >= 0xfc00 && first <= 0xfdff) return true;

  return false;
}
