import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadPhotos } from "./uploadPhotos";

function photo(name: string, type = "image/jpeg", sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

function fakeSupabase(opts: { uploadErrorOnCall?: number } = {}) {
  let uploadCallCount = 0;
  const upload = vi.fn().mockImplementation(() => {
    uploadCallCount += 1;
    if (opts.uploadErrorOnCall && uploadCallCount === opts.uploadErrorOnCall) {
      return Promise.resolve({ data: null, error: new Error("upload failed") });
    }
    return Promise.resolve({ data: { path: `path-${uploadCallCount}` }, error: null });
  });
  const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }));
  const storageFrom = vi.fn().mockReturnValue({ upload, getPublicUrl });
  return { storage: { from: storageFrom } } as unknown as SupabaseClient;
}

describe("uploadPhotos", () => {
  it("returns an empty array for zero photos without calling storage", async () => {
    const supabase = fakeSupabase();
    await expect(uploadPhotos(supabase, [])).resolves.toEqual([]);
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it("uploads each photo to establishment-photos and returns the public URLs from the upload response's path", async () => {
    const supabase = fakeSupabase();
    const urls = await uploadPhotos(supabase, [photo("a.jpg"), photo("b.jpg")]);
    expect(supabase.storage.from).toHaveBeenCalledWith("establishment-photos");
    expect(urls).toEqual(["https://cdn.test/path-1", "https://cdn.test/path-2"]);
  });

  it("derives the storage key from a random id and the photo's MIME type, never the raw filename", async () => {
    const supabase = fakeSupabase();
    const accentedPhoto = photo("café com ç e espaço.jpg", "image/jpeg");
    await uploadPhotos(supabase, [accentedPhoto]);
    const uploadMock = supabase.storage.from("establishment-photos").upload as ReturnType<typeof vi.fn>;
    const [storageKey] = uploadMock.mock.calls[0];
    expect(storageKey).toMatch(/^[a-z0-9-]+\.jpg$/);
  });

  it("maps png and webp mime types to the correct extension", async () => {
    const supabase = fakeSupabase();
    await uploadPhotos(supabase, [photo("a.png", "image/png"), photo("b.webp", "image/webp")]);
    const uploadMock = supabase.storage.from("establishment-photos").upload as ReturnType<typeof vi.fn>;
    expect(uploadMock.mock.calls[0][0]).toMatch(/\.png$/);
    expect(uploadMock.mock.calls[1][0]).toMatch(/\.webp$/);
  });

  it("stops after the second of three photos fails to upload", async () => {
    const supabase = fakeSupabase({ uploadErrorOnCall: 2 });
    await expect(
      uploadPhotos(supabase, [photo("a.jpg"), photo("b.jpg"), photo("c.jpg")]),
    ).rejects.toThrow("upload failed");
    const uploadMock = supabase.storage.from("establishment-photos").upload as ReturnType<typeof vi.fn>;
    expect(uploadMock).toHaveBeenCalledTimes(2);
  });
});
