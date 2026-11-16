import { describe, expect, it } from "vitest";
import { isBlockedImageHost, plainText, safeUrl } from "./security.ts";

describe("safeUrl", () => {
  it("aceita http e https válidos", () => {
    expect(safeUrl("http://example.com/a")).toBe("http://example.com/a");
    expect(safeUrl("https://example.com/a?b=1")).toBe(
      "https://example.com/a?b=1",
    );
  });

  it.each([
    "javascript:alert(1)",
    "file:///etc/passwd",
    "não é uma url",
    "",
    "https://user:pass@example.com/",
  ])("recusa %s", (value) => {
    expect(safeUrl(value)).toBeNull();
  });

  it("recusa null e undefined", () => {
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
  });
});

describe("isBlockedImageHost", () => {
  it.each([
    "localhost",
    "127.0.0.1",
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.10",
    "169.254.169.254",
    "[::1]",
  ])("bloqueia %s", (host) => {
    expect(isBlockedImageHost(host)).toBe(true);
  });

  it.each(["example.com", "news.example.org", "8.8.8.8", "172.32.0.1"])(
    "libera %s",
    (host) => {
      expect(isBlockedImageHost(host)).toBe(false);
    },
  );

  it("bloqueia o hostname de uma URL local", () => {
    expect(isBlockedImageHost(new URL("http://[::1]:11434/").hostname)).toBe(
      true,
    );
  });
});

describe("plainText", () => {
  it("remove tags HTML", () => {
    expect(plainText("<p>Olá <strong>mundo</strong></p>")).toBe("Olá mundo");
  });

  it("decodifica entidades básicas", () => {
    expect(plainText("A &amp; B &lt;C&gt;")).toBe("A & B <C>");
  });

  it("normaliza espaços", () => {
    expect(plainText("  um   dois\n\t três  ")).toBe("um dois três");
  });

  it("descarta scripts, estilos, imagens e links", () => {
    expect(
      plainText(
        '<script>x()</script><style>p{}</style><img src="a.png">' +
          '<a href="https://example.com">texto</a>',
      ),
    ).toBe("texto");
  });
});
