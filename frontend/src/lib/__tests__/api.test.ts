import { describe, it, expect, vi, afterEach } from "vitest";
import { ENGINE_URL, offlineMessage, engineHealth, postJson } from "../api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("offlineMessage", () => {
  it("names the engine URL and the failed operation", () => {
    const msg = offlineMessage("Export");
    expect(msg).toContain(ENGINE_URL);
    expect(msg).toContain("Export");
  });
});

describe("engineHealth", () => {
  it("returns true when the engine answers ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await expect(engineHealth()).resolves.toBe(true);
  });

  it("returns false on a non-ok status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(engineHealth()).resolves.toBe(false);
  });

  it("returns false when the engine is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    await expect(engineHealth()).resolves.toBe(false);
  });
});

describe("postJson", () => {
  it("posts JSON to the engine and parses a JSON response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ pooled: { effect: 1.42 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await postJson<{ pooled: { effect: number } }>("/api/meta", { model: "random" });
    expect(out.pooled.effect).toBe(1.42);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${ENGINE_URL}/api/meta`);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ model: "random" });
  });

  it("falls back to text when the response is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "text/plain" },
      text: async () => "plain-body",
    }));
    const out = await postJson<string>("/api/export", {});
    expect(out).toBe("plain-body");
  });

  it("throws a status-bearing error on non-ok responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "bad payload",
    }));
    await expect(postJson("/api/meta", {})).rejects.toThrow("422");
  });

  it("translates network failures into the offline message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(postJson("/api/meta", {})).rejects.toThrow(/not reachable/);
  });

  it("reports timeouts distinctly", async () => {
    const timeoutErr = new DOMException("timed out", "TimeoutError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutErr));
    await expect(postJson("/api/meta", {}, 2000)).rejects.toThrow(/timed out after 2s/);
  });
});
