import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HttpError,
  fetchStatic,
  isRetryable,
} from "../src/crawler/fetchPage.js";

function htmlResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html" },
  });
}

function errorResponse(status: number): Response {
  return new Response("boom", {
    status,
    headers: { "content-type": "text/html" },
  });
}

describe("isRetryable", () => {
  it("retries on 429 and 5xx", () => {
    expect(isRetryable(new HttpError(429, "Too Many Requests"))).toBe(true);
    expect(isRetryable(new HttpError(503, "Service Unavailable"))).toBe(true);
  });

  it("does not retry on 4xx (except 429)", () => {
    expect(isRetryable(new HttpError(404, "Not Found"))).toBe(false);
    expect(isRetryable(new HttpError(403, "Forbidden"))).toBe(false);
  });

  it("does not retry on non-HTML content", () => {
    const err = new Error("Unsupported content-type: application/pdf");
    err.name = "NonRetryableError";
    expect(isRetryable(err)).toBe(false);
  });

  it("retries on generic network/timeout errors", () => {
    expect(isRetryable(new Error("network down"))).toBe(true);
  });
});

describe("fetchStatic retries", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries transient 500s then succeeds", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(htmlResponse("<html>ok</html>"));

    const result = await fetchStatic("https://example.com/page");
    expect(result.html).toContain("ok");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after exhausting retries and throws the last error", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(errorResponse(503));

    await expect(fetchStatic("https://example.com/page")).rejects.toThrow(
      /HTTP 503/,
    );
    // 1 initial + CRAWL_MAX_RETRIES (default 2) = 3 attempts.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry on a 404", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(errorResponse(404));

    await expect(fetchStatic("https://example.com/page")).rejects.toThrow(
      /HTTP 404/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
