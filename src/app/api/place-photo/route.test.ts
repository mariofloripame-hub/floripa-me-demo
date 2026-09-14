import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

const ORIGINAL_KEY = process.env.GOOGLE_PLACES_API_KEY;

describe("GET /api/place-photo", () => {
  beforeEach(() => {
    process.env.GOOGLE_PLACES_API_KEY = "server-only-fake-key";
  });

  afterEach(() => {
    process.env.GOOGLE_PLACES_API_KEY = ORIGINAL_KEY;
    vi.restoreAllMocks();
  });

  it("returns 400 without hitting Google when 'ref' is missing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await GET(new Request("http://localhost/api/place-photo"));
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a ref that doesn't match the Google photo resource shape, without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await GET(
      new Request("http://localhost/api/place-photo?ref=" + encodeURIComponent("https://evil.example.com/x")),
    );
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches the photo from Google server-side and streams it back, without leaking the key in the response", async () => {
    const imageBytes = new Uint8Array([1, 2, 3]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(imageBytes, { status: 200, headers: { "content-type": "image/jpeg" } }),
    );

    const ref = "places/ChIJ-fake-id/photos/abc";
    const response = await GET(new Request(`http://localhost/api/place-photo?ref=${encodeURIComponent(ref)}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toContain("max-age");

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain(`https://places.googleapis.com/v1/${ref}/media`);
    expect(calledUrl).toContain("key=server-only-fake-key");

    const body = new Uint8Array(await response.arrayBuffer());
    expect(body).toEqual(imageBytes);
    // The proxy's own response — what reaches the browser — must never
    // contain the API key; only the server-to-server request above does.
    expect(JSON.stringify([...response.headers.entries()])).not.toContain("server-only-fake-key");
  });

  it("returns 404 when Google can't find the photo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
    const ref = "places/ChIJ-missing/photos/abc";
    const response = await GET(new Request(`http://localhost/api/place-photo?ref=${encodeURIComponent(ref)}`));
    expect(response.status).toBe(404);
  });

  it("returns 500 when the server has no API key configured", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const ref = "places/ChIJ-fake-id/photos/abc";
    const response = await GET(new Request(`http://localhost/api/place-photo?ref=${encodeURIComponent(ref)}`));
    expect(response.status).toBe(500);
  });
});
