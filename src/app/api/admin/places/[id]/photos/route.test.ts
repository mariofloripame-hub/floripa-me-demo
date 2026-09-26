// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({ getPlaceById: vi.fn(), updatePlace: vi.fn() }));
vi.mock("@/lib/estabelecimentos/uploadPhotos", () => ({ uploadPhotos: vi.fn() }));

import { POST } from "./route";
import { getPlaceById, updatePlace } from "@/lib/supabase/queries";
import { uploadPhotos } from "@/lib/estabelecimentos/uploadPhotos";

beforeEach(() => {
  vi.mocked(getPlaceById).mockReset();
  vi.mocked(updatePlace).mockReset();
  vi.mocked(uploadPhotos).mockReset();
});

function photo(name: string): File {
  return new File([new Uint8Array(10)], name, { type: "image/jpeg" });
}

function formRequest(photos: File[]) {
  const formData = new FormData();
  for (const p of photos) formData.append("photos", p);
  return new Request("http://localhost/x", { method: "POST", body: formData }) as never;
}

describe("POST /api/admin/places/[id]/photos", () => {
  it("appends newly uploaded photo URLs to the place's existing photos", async () => {
    vi.mocked(getPlaceById).mockResolvedValue({ id: "p1", photos: ["https://cdn.test/old.jpg"] } as never);
    vi.mocked(uploadPhotos).mockResolvedValue(["https://cdn.test/new.jpg"]);
    vi.mocked(updatePlace).mockResolvedValue({
      id: "p1",
      photos: ["https://cdn.test/old.jpg", "https://cdn.test/new.jpg"],
    } as never);

    const response = await POST(formRequest([photo("a.jpg")]), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(200);
    expect(updatePlace).toHaveBeenCalledWith(expect.anything(), "p1", {
      photos: ["https://cdn.test/old.jpg", "https://cdn.test/new.jpg"],
    });
  });

  it("returns 404 without uploading when the place doesn't exist", async () => {
    vi.mocked(getPlaceById).mockResolvedValue(null);
    const response = await POST(formRequest([photo("a.jpg")]), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
    expect(uploadPhotos).not.toHaveBeenCalled();
  });

  it("rejects when the existing photo count plus the new batch would exceed the maximum, without uploading", async () => {
    const existing = Array.from({ length: 5 }, (_, i) => `https://cdn.test/e${i}.jpg`);
    vi.mocked(getPlaceById).mockResolvedValue({ id: "p1", photos: existing } as never);

    const response = await POST(
      formRequest([photo("a.jpg"), photo("b.jpg")]),
      { params: Promise.resolve({ id: "p1" }) },
    );
    expect(response.status).toBe(400);
    expect(uploadPhotos).not.toHaveBeenCalled();
  });
});
