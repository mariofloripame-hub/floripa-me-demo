# Painel Admin de Estabelecimentos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the team a password-gated `/admin` panel to list, approve, create, edit, and delete `places` rows — including photo management — replacing the Supabase Table Editor as the review workflow.

**Architecture:** A single shared-password session cookie (`sha256(ADMIN_PASSWORD)`, set by a login route, checked by Next.js middleware on every `/admin/*` and `/api/admin/*` request) gates a set of REST-style API routes under `/api/admin/places` and two pages: a tabbed list (`/admin`) and one shared create/edit form component used by both `/admin/estabelecimentos/novo` and `/admin/estabelecimentos/[id]`.

**Tech Stack:** Next.js 15 (App Router, middleware), React 19, TypeScript, Zod, `react-hook-form` + `@hookform/resolvers` (already dependencies from the self-signup feature), `@supabase/supabase-js`, Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-09-26-painel-admin-estabelecimentos-design.md](../specs/2026-09-26-painel-admin-estabelecimentos-design.md)

## Global Constraints

- No per-user accounts — a single shared password (`ADMIN_PASSWORD` env var, never committed) protects the whole panel via one session cookie.
- Delete is permanent (hard delete) — no soft-delete, no recovery, no confirmation beyond the browser's own `confirm()`.
- Removing a photo in the edit form only drops its URL from `photos[]` — the file is never deleted from Storage.
- `partner_status` is constrained to a fixed set only at the Zod/form layer (`"" | "cortesia" | "pago"`) — the `places.partner_status` column itself stays plain `text`, no migration.
- The admin schema (`adminPlaceFieldsSchema`) reuses `CATEGORY_OPTIONS`/`REGION_OPTIONS`/`PRICE_RANGE_OPTIONS` from the existing public `schema.ts` — never redefines them — but makes `contact_name`/`contact_email`/`contact_phone` optional (unlike the public form), since an admin-authored listing may have no separate submitter to contact.
- Admin-created places set `submission_source: "admin"` and take `is_verified`/`is_partner`/`partner_status`/`partner_plan`/`partner_offer` directly from whatever the admin chose in the form — never hardcoded to `false`/`null` the way self-signup rows are.

## Review Focus

- Visiting any `/admin/*` page or calling any `/api/admin/*` route without a valid session cookie must be blocked — a page request redirects to `/admin/login`, an API request gets `401`. Covered in Task 6 (middleware).
- The one-click "Aprovar" action sends a partial PATCH body (just `{ is_verified: true }`) — this must succeed without the other, otherwise-required fields being present. Covered in Task 4 (schema) and Task 8 (route).
- Uploading more photos to an existing place via the incremental upload endpoint must be rejected once the *existing* count plus the *new* batch would exceed the maximum — not just checking the new batch in isolation. Covered in Task 9.
- A boolean field arriving from multipart form data as the literal string `"false"` (e.g. an unchecked "É parceiro" box in the create form) must be stored as `false`, never coerced to `true` just because the string is non-empty. Covered in Task 7.
- `DELETE`/`GET` on a place id that no longer exists must degrade gracefully — `DELETE` stays idempotent and returns `200`, `GET` returns `404` — rather than crashing or surfacing a confusing `500`. Covered in Task 8.

---

## Task 1: Extract the shared photo-upload helper

The self-signup feature's `submitEstablishment.ts` has a private `uploadPhotos` function. The admin panel's create and photo-upload endpoints need the identical logic (upload to Storage, derive the key from a random id + MIME-derived extension, return public URLs). Extracting it now avoids two copies drifting apart.

**Files:**
- Create: `src/lib/estabelecimentos/uploadPhotos.ts`
- Test: `src/lib/estabelecimentos/uploadPhotos.test.ts`
- Modify: `src/lib/estabelecimentos/submitEstablishment.ts`
- Modify: `src/lib/estabelecimentos/submitEstablishment.test.ts`

**Interfaces:**
- Produces: `uploadPhotos(supabase: SupabaseClient, photos: File[]): Promise<string[]>`. Tasks 7 and 9 import this.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/estabelecimentos/uploadPhotos.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/estabelecimentos/uploadPhotos.test.ts`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/estabelecimentos/uploadPhotos.ts
import type { SupabaseClient } from "@supabase/supabase-js";

const PHOTO_BUCKET = "establishment-photos";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadPhotos(supabase: SupabaseClient, photos: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const photo of photos) {
    const extension = EXTENSION_BY_MIME[photo.type] ?? "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;
    const { data: uploadData, error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo);
    if (error) throw error;
    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(uploadData.path);
    urls.push(data.publicUrl);
  }
  return urls;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/estabelecimentos/uploadPhotos.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `submitEstablishment.ts` to use the shared helper**

Replace its local `PHOTO_BUCKET`/`EXTENSION_BY_MIME`/`uploadPhotos` with an import, and delete the now-unused local copies:

```ts
// src/lib/estabelecimentos/submitEstablishment.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { establishmentFieldsSchema, validatePhotos } from "./schema";
import { insertPlace } from "@/lib/supabase/queries";
import { uploadPhotos } from "./uploadPhotos";

export class InvalidFieldsError extends Error {
  fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>) {
    super("Dados do formulário inválidos");
    this.fieldErrors = fieldErrors;
  }
}

export class InvalidPhotosError extends Error {}

export interface SubmitEstablishmentInput {
  fields: Record<string, unknown>;
  photos: File[];
  honeypot: string;
}

export interface SubmitEstablishmentDeps {
  supabase: SupabaseClient;
}

export async function submitEstablishment(
  input: SubmitEstablishmentInput,
  deps: SubmitEstablishmentDeps,
): Promise<{ skipped: boolean }> {
  if (input.honeypot.trim() !== "") {
    return { skipped: true };
  }

  const parsed = establishmentFieldsSchema.safeParse(input.fields);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    throw new InvalidFieldsError(fieldErrors);
  }

  const photoError = validatePhotos(input.photos);
  if (photoError) {
    throw new InvalidPhotosError(photoError);
  }

  const photoUrls = await uploadPhotos(deps.supabase, input.photos);

  await insertPlace(deps.supabase, {
    ...parsed.data,
    photos: photoUrls,
    is_verified: false,
    is_partner: false,
    submission_source: "self_signup",
    target_profiles: [],
    special_needs_tags: [],
    lat: null,
    lng: null,
    google_place_id: null,
    rating: null,
    notes: null,
    partner_plan: null,
    partner_offer: null,
    partner_status: null,
  });

  return { skipped: false };
}
```

- [ ] **Step 6: Remove the now-redundant upload-mechanics test from `submitEstablishment.test.ts`**

Delete only the `it("derives the storage key from a random id and the photo's MIME type, never the raw filename", ...)` block — that coverage now lives in `uploadPhotos.test.ts` (Step 1 above). Keep `it("stops after the second of three photos fails to upload, and never inserts", ...)` as-is: it also proves `submitEstablishment` never calls `insertPlace` after an upload failure, which is orchestration behavior specific to `submitEstablishment`, not to `uploadPhotos`.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS (all existing tests, including the ones still in `submitEstablishment.test.ts`, remain green — they exercise the same behavior through the now-imported `uploadPhotos`).

- [ ] **Step 8: Commit**

```bash
git add src/lib/estabelecimentos/uploadPhotos.ts src/lib/estabelecimentos/uploadPhotos.test.ts src/lib/estabelecimentos/submitEstablishment.ts src/lib/estabelecimentos/submitEstablishment.test.ts
git commit -m "refactor(estabelecimentos): extract shared uploadPhotos helper"
```

---

## Task 2: `updatePlace` and `deletePlace` query helpers

**Files:**
- Modify: `src/lib/supabase/queries.ts`
- Modify: `src/lib/supabase/queries.test.ts`

**Interfaces:**
- Consumes: `Place` type from `./types`.
- Produces: `updatePlace(client: SupabaseClient, id: string, patch: Partial<Omit<Place, "id" | "created_at">>): Promise<Place>` and `deletePlace(client: SupabaseClient, id: string): Promise<void>`. Tasks 8 and 9 call both; Task 7 does not need them.

- [ ] **Step 1: Write the failing tests**

In `src/lib/supabase/queries.test.ts`, add `updatePlace` and `deletePlace` to the existing import list, add `chain.delete = self;` to `makeChain` (it currently defines `select`/`eq`/`insert`/`update` but not `delete`), and add:

```ts
  it("updatePlace patches arbitrary fields and returns the updated row", async () => {
    const patch = { is_verified: true, is_partner: true };
    const updated = { id: "p1", name: "JJR Surfe Coach", ...patch };
    const client = fakeClientFor("places", makeChain({ data: updated, error: null }));
    await expect(updatePlace(client, "p1", patch)).resolves.toEqual(updated);
  });

  it("deletePlace removes the row by id", async () => {
    const client = fakeClientFor("places", makeChain({ data: null, error: null }));
    await expect(deletePlace(client, "p1")).resolves.toBeUndefined();
    expect(client.from).toHaveBeenCalledWith("places");
  });

  it("deletePlace throws when Supabase returns an error", async () => {
    const client = fakeClientFor("places", makeChain({ data: null, error: new Error("boom") }));
    await expect(deletePlace(client, "p1")).rejects.toThrow("boom");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/supabase/queries.test.ts`
Expected: FAIL — `updatePlace`/`deletePlace` not defined.

- [ ] **Step 3: Implement both helpers**

Add to `src/lib/supabase/queries.ts` (near `updatePlaceEnrichment`):

```ts
export async function updatePlace(
  client: SupabaseClient,
  id: string,
  patch: Partial<Omit<Place, "id" | "created_at">>,
): Promise<Place> {
  const { data, error } = await client.from("places").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Place;
}

export async function deletePlace(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("places").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/supabase/queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries.ts src/lib/supabase/queries.test.ts
git commit -m "feat(supabase): add updatePlace and deletePlace query helpers"
```

---

## Task 3: `adminAuth.ts` — password check and session token

**Files:**
- Create: `src/lib/adminAuth.ts`
- Test: `src/lib/adminAuth.test.ts`

**Interfaces:**
- Produces: `ADMIN_SESSION_COOKIE: string`, `ADMIN_SESSION_MAX_AGE_SECONDS: number`, `createAdminSessionToken(): string`, `isCorrectAdminPassword(candidate: string): boolean`, `isValidAdminSession(cookieValue: string | undefined | null): boolean`. Tasks 5 and 6 import these.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/adminAuth.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createAdminSessionToken, isCorrectAdminPassword, isValidAdminSession } from "./adminAuth";

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", "correct-horse-battery-staple");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isCorrectAdminPassword", () => {
  it("accepts the correct password", () => {
    expect(isCorrectAdminPassword("correct-horse-battery-staple")).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(isCorrectAdminPassword("wrong")).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(isCorrectAdminPassword("")).toBe(false);
  });
});

describe("createAdminSessionToken / isValidAdminSession", () => {
  it("accepts the token createAdminSessionToken produces", () => {
    expect(isValidAdminSession(createAdminSessionToken())).toBe(true);
  });

  it("rejects a missing cookie value", () => {
    expect(isValidAdminSession(undefined)).toBe(false);
    expect(isValidAdminSession(null)).toBe(false);
    expect(isValidAdminSession("")).toBe(false);
  });

  it("rejects a tampered token of the same length", () => {
    const token = createAdminSessionToken();
    const tampered = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    expect(isValidAdminSession(tampered)).toBe(false);
  });

  it("rejects a value of a completely different length without throwing", () => {
    expect(() => isValidAdminSession("short")).not.toThrow();
    expect(isValidAdminSession("short")).toBe(false);
  });
});

describe("when ADMIN_PASSWORD is not configured", () => {
  it("isCorrectAdminPassword returns false instead of throwing", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(() => isCorrectAdminPassword("anything")).not.toThrow();
    expect(isCorrectAdminPassword("anything")).toBe(false);
  });

  it("isValidAdminSession returns false instead of throwing", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(() => isValidAdminSession("anything")).not.toThrow();
    expect(isValidAdminSession("anything")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/adminAuth.test.ts`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/adminAuth.ts
import { createHash, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "floripa_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD must be set");
  return password;
}

export function createAdminSessionToken(): string {
  return sha256Hex(getAdminPassword());
}

export function isCorrectAdminPassword(candidate: string): boolean {
  try {
    const expected = Buffer.from(sha256Hex(getAdminPassword()));
    const actual = Buffer.from(sha256Hex(candidate));
    return timingSafeEqual(expected, actual);
  } catch {
    // ADMIN_PASSWORD isn't configured — deny access cleanly rather than
    // crash every login attempt (and, via isValidAdminSession below, every
    // /admin request) with an unhandled exception.
    return false;
  }
}

export function isValidAdminSession(cookieValue: string | undefined | null): boolean {
  if (!cookieValue) return false;
  try {
    const expected = Buffer.from(createAdminSessionToken());
    const actual = Buffer.from(cookieValue);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/adminAuth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/adminAuth.ts src/lib/adminAuth.test.ts
git commit -m "feat(admin): add shared-password session token helpers"
```

---

## Task 4: `adminSchema.ts` — admin field validation

**Files:**
- Create: `src/lib/estabelecimentos/adminSchema.ts`
- Test: `src/lib/estabelecimentos/adminSchema.test.ts`

**Interfaces:**
- Consumes: `CATEGORY_OPTIONS`, `REGION_OPTIONS`, `PRICE_RANGE_OPTIONS` from `./schema`.
- Produces: `PARTNER_STATUS_OPTIONS: readonly {value: string; label: string}[]`, `adminPlaceFieldsSchema: ZodObject`, `type AdminPlaceFields`, `adminPlacePatchSchema: ZodObject` (same shape, all optional, plus an optional `photos: string[]`), `type AdminPlacePatch`. Tasks 7, 8, 9, and 12 import from this file.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/estabelecimentos/adminSchema.test.ts
import { describe, it, expect } from "vitest";
import { adminPlaceFieldsSchema, adminPlacePatchSchema, PARTNER_STATUS_OPTIONS } from "./adminSchema";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "JJR Surfe Coach", category: "Esporte", point_type: "Aula de Surf",
    short_description: "Aulas particulares e em grupo de surf no Campeche.",
    region: "Sul", neighborhood: "Campeche", address: "Servidão A Caminho das Dunas",
    price_range: "R$", opening_hours: "Seg a Seg", phone: "(48) 99828-2601",
    instagram: "@surfcoachjjr", is_verified: true, is_partner: true,
    partner_status: "cortesia", partner_plan: "Mensal", partner_offer: "",
    ...overrides,
  };
}

describe("adminPlaceFieldsSchema", () => {
  it("accepts a full valid payload without any contact info", () => {
    const result = adminPlaceFieldsSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("rejects an invalid partner_status", () => {
    const result = adminPlaceFieldsSchema.safeParse(validPayload({ partner_status: "vip" }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean is_verified", () => {
    const result = adminPlaceFieldsSchema.safeParse(validPayload({ is_verified: "true" }));
    expect(result.success).toBe(false);
  });

  it("still requires the core business fields", () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).name;
    const result = adminPlaceFieldsSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe("adminPlacePatchSchema", () => {
  it("accepts a partial payload with only is_verified, for the quick-approve action", () => {
    const result = adminPlacePatchSchema.safeParse({ is_verified: true });
    expect(result.success).toBe(true);
  });

  it("still validates a field's format when it is present", () => {
    const result = adminPlacePatchSchema.safeParse({ partner_status: "vip" });
    expect(result.success).toBe(false);
  });

  it("accepts a photos array", () => {
    const result = adminPlacePatchSchema.safeParse({ photos: ["https://cdn.test/a.jpg"] });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object (no-op patch)", () => {
    expect(adminPlacePatchSchema.safeParse({}).success).toBe(true);
  });
});

describe("PARTNER_STATUS_OPTIONS", () => {
  it("includes Nenhum, Cortesia, and Pago in that order", () => {
    expect(PARTNER_STATUS_OPTIONS.map((o) => o.label)).toEqual(["Nenhum", "Cortesia", "Pago"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/estabelecimentos/adminSchema.test.ts`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/estabelecimentos/adminSchema.ts
import { z } from "zod";
import { CATEGORY_OPTIONS, REGION_OPTIONS, PRICE_RANGE_OPTIONS } from "./schema";

export const PARTNER_STATUS_OPTIONS = [
  { value: "", label: "Nenhum" },
  { value: "cortesia", label: "Cortesia" },
  { value: "pago", label: "Pago" },
] as const;

const PARTNER_STATUS_VALUES = PARTNER_STATUS_OPTIONS.map((option) => option.value) as [string, ...string[]];

function requiredText(min = 1, message = "Campo obrigatório") {
  return z.string().trim().min(min, message);
}

export const adminPlaceFieldsSchema = z.object({
  name: requiredText(),
  category: z.enum(CATEGORY_OPTIONS),
  point_type: requiredText(),
  short_description: requiredText(10, "Descreva em pelo menos 10 caracteres"),
  region: z.enum(REGION_OPTIONS),
  neighborhood: requiredText(),
  address: requiredText(),
  price_range: z.enum(PRICE_RANGE_OPTIONS),
  opening_hours: requiredText(),
  phone: requiredText(),
  instagram: z.string().trim().optional().default(""),
  contact_name: z.string().trim().optional().default(""),
  contact_email: z.string().trim().optional().default(""),
  contact_phone: z.string().trim().optional().default(""),
  is_verified: z.boolean(),
  is_partner: z.boolean(),
  partner_status: z.enum(PARTNER_STATUS_VALUES),
  partner_plan: z.string().trim().optional().default(""),
  partner_offer: z.string().trim().optional().default(""),
});

export type AdminPlaceFields = z.infer<typeof adminPlaceFieldsSchema>;

export const adminPlacePatchSchema = adminPlaceFieldsSchema.partial().extend({
  photos: z.array(z.string()).optional(),
});

export type AdminPlacePatch = z.infer<typeof adminPlacePatchSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/estabelecimentos/adminSchema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/estabelecimentos/adminSchema.ts src/lib/estabelecimentos/adminSchema.test.ts
git commit -m "feat(admin): add admin place validation schema"
```

---

## Task 5: Login and logout API routes

**Files:**
- Create: `src/app/api/admin/login/route.ts`
- Test: `src/app/api/admin/login/route.test.ts`
- Create: `src/app/api/admin/logout/route.ts`
- Test: `src/app/api/admin/logout/route.test.ts`
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: `isCorrectAdminPassword`, `createAdminSessionToken`, `ADMIN_SESSION_COOKIE`, `ADMIN_SESSION_MAX_AGE_SECONDS` from `@/lib/adminAuth` (Task 3).
- Produces: `POST` handlers at `/api/admin/login` and `/api/admin/logout`. Task 10 (login page) calls the first over HTTP.

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/admin/login/route.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", "correct-horse-battery-staple");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

import { POST } from "./route";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "@/lib/adminAuth";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/login", { method: "POST", body: JSON.stringify(body) }) as never;
}

describe("POST /api/admin/login", () => {
  it("sets the session cookie and returns ok on the correct password", async () => {
    const response = await POST(jsonRequest({ password: "correct-horse-battery-staple" }));
    expect(response.status).toBe(200);
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)?.value).toBe(createAdminSessionToken());
  });

  it("returns 401 without setting a cookie on the wrong password", async () => {
    const response = await POST(jsonRequest({ password: "wrong" }));
    expect(response.status).toBe(401);
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)).toBeUndefined();
  });

  it("returns 401 when the body has no password field", async () => {
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(401);
  });
});
```

```ts
// src/app/api/admin/logout/route.test.ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";

describe("POST /api/admin/logout", () => {
  it("clears the session cookie", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? "").toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/admin/login/route.test.ts src/app/api/admin/logout/route.test.ts`
Expected: FAIL — both `./route` modules don't exist yet.

- [ ] **Step 3: Write the implementations**

```ts
// src/app/api/admin/login/route.ts
import { NextResponse } from "next/server";
import {
  isCorrectAdminPassword,
  createAdminSessionToken,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
} from "@/lib/adminAuth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password || !isCorrectAdminPassword(password)) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}
```

```ts
// src/app/api/admin/logout/route.ts
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/admin/login/route.test.ts src/app/api/admin/logout/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `ADMIN_PASSWORD` to the env example**

In `.env.local.example`, add near the other keys:

```
ADMIN_PASSWORD=
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/login/route.ts src/app/api/admin/login/route.test.ts src/app/api/admin/logout/route.ts src/app/api/admin/logout/route.test.ts .env.local.example
git commit -m "feat(admin): add login and logout routes"
```

---

## Task 6: Middleware — gate `/admin/*` and `/api/admin/*`

**Files:**
- Create: `src/middleware.ts`
- Test: `src/middleware.test.ts`

**Interfaces:**
- Consumes: `ADMIN_SESSION_COOKIE`, `isValidAdminSession` from `@/lib/adminAuth` (Task 3).
- Produces: `middleware(request: NextRequest): NextResponse` and `config` (Next.js's required exports for this file — no other task imports them; Next.js itself invokes `middleware` at request time).

- [ ] **Step 1: Write the failing tests**

```ts
// src/middleware.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", "correct-horse-battery-staple");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

import { middleware } from "./middleware";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "@/lib/adminAuth";

function requestFor(path: string, cookieValue?: string) {
  const headers: Record<string, string> = {};
  if (cookieValue !== undefined) headers.cookie = `${ADMIN_SESSION_COOKIE}=${cookieValue}`;
  return new NextRequest(new URL(path, "http://localhost"), { headers });
}

describe("middleware", () => {
  it("lets /admin/login through with no cookie", () => {
    expect(middleware(requestFor("/admin/login")).status).toBe(200);
  });

  it("lets /api/admin/login through with no cookie", () => {
    expect(middleware(requestFor("/api/admin/login")).status).toBe(200);
  });

  it("redirects an unauthenticated page request to /admin/login", () => {
    const response = middleware(requestFor("/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin/login");
  });

  it("returns 401 for an unauthenticated API request", () => {
    expect(middleware(requestFor("/api/admin/places")).status).toBe(401);
  });

  it("lets an authenticated page request through", () => {
    expect(middleware(requestFor("/admin", createAdminSessionToken())).status).toBe(200);
  });

  it("lets an authenticated API request through", () => {
    expect(middleware(requestFor("/api/admin/places", createAdminSessionToken())).status).toBe(200);
  });

  it("blocks a request with a tampered cookie", () => {
    expect(middleware(requestFor("/admin", "tampered")).status).toBe(307);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/middleware.test.ts`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the implementation**

```ts
// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/adminAuth";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/login"];

export function middleware(request: NextRequest) {
  if (PUBLIC_ADMIN_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (isValidAdminSession(cookie)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/middleware.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/middleware.ts src/middleware.test.ts
git commit -m "feat(admin): add session-cookie middleware for /admin and /api/admin"
```

---

## Task 7: `GET`/`POST /api/admin/places`

**Files:**
- Create: `src/app/api/admin/places/route.ts`
- Test: `src/app/api/admin/places/route.test.ts`

**Interfaces:**
- Consumes: `listPlaces`, `insertPlace` from `@/lib/supabase/queries`; `adminPlaceFieldsSchema` from `@/lib/estabelecimentos/adminSchema` (Task 4); `validatePhotos` from `@/lib/estabelecimentos/schema`; `uploadPhotos` from `@/lib/estabelecimentos/uploadPhotos` (Task 1).
- Produces: `GET`, `POST` handlers. No other task imports these directly (the frontend calls them over HTTP).

This test file constructs `FormData` with real `File` objects. jsdom's `FormData`/`File` implementation has a webidl brand-check bug that rejects a real `File` appended to a `FormData` (already hit and worked around in the self-signup feature's `route.test.ts`) — add `// @vitest-environment node` at the top of this file, same fix, so `Request`/`FormData`/`File` come from Node instead of jsdom.

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/admin/places/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({ listPlaces: vi.fn(), insertPlace: vi.fn() }));
vi.mock("@/lib/estabelecimentos/uploadPhotos", () => ({ uploadPhotos: vi.fn().mockResolvedValue([]) }));

import { GET, POST } from "./route";
import { listPlaces, insertPlace } from "@/lib/supabase/queries";
import { uploadPhotos } from "@/lib/estabelecimentos/uploadPhotos";

const FIELDS = {
  name: "JJR Surfe Coach", category: "Esporte", point_type: "Aula de Surf",
  short_description: "Aulas particulares e em grupo de surf no Campeche.",
  region: "Sul", neighborhood: "Campeche", address: "Servidão A Caminho das Dunas",
  price_range: "R$", opening_hours: "Seg a Seg", phone: "(48) 99828-2601",
  instagram: "@surfcoachjjr", partner_status: "cortesia",
};

function formRequest(fields: Record<string, string>, extra: Record<string, string> = {}, photos: File[] = []) {
  const formData = new FormData();
  for (const [key, value] of Object.entries({ ...fields, ...extra })) formData.append(key, value);
  for (const photo of photos) formData.append("photos", photo);
  return new Request("http://localhost/api/admin/places", { method: "POST", body: formData }) as never;
}

describe("GET /api/admin/places", () => {
  it("returns the full list of places", async () => {
    vi.mocked(listPlaces).mockResolvedValue([{ id: "1" } as never]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "1" }]);
  });
});

describe("POST /api/admin/places", () => {
  it("creates a place with is_verified/is_partner coerced from form strings", async () => {
    vi.mocked(insertPlace).mockResolvedValue({ id: "new-1" } as never);
    const response = await POST(formRequest(FIELDS, { is_verified: "true", is_partner: "false" }));
    expect(response.status).toBe(201);
    expect(insertPlace).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ is_verified: true, is_partner: false, submission_source: "admin" }),
    );
  });

  it("stores is_partner as false when the form sends the literal string \"false\", not just any non-empty string", async () => {
    vi.mocked(insertPlace).mockResolvedValue({ id: "new-1" } as never);
    await POST(formRequest(FIELDS, { is_verified: "false", is_partner: "false" }));
    expect(insertPlace).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ is_verified: false, is_partner: false }),
    );
  });

  it("returns 400 with field errors when a required field is missing, without inserting", async () => {
    const incomplete: Record<string, string> = { ...FIELDS };
    delete incomplete.name;
    const response = await POST(formRequest(incomplete, { is_verified: "true", is_partner: "false" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors.name).toBeDefined();
    expect(insertPlace).not.toHaveBeenCalled();
  });

  it("returns 400 when there are too many photos, without uploading any", async () => {
    const photos = Array.from(
      { length: 7 },
      (_, i) => new File([new Uint8Array(10)], `p${i}.jpg`, { type: "image/jpeg" }),
    );
    const response = await POST(formRequest(FIELDS, { is_verified: "true", is_partner: "false" }, photos));
    expect(response.status).toBe(400);
    expect(uploadPhotos).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/admin/places/route.test.ts`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/admin/places/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { listPlaces, insertPlace } from "@/lib/supabase/queries";
import { adminPlaceFieldsSchema } from "@/lib/estabelecimentos/adminSchema";
import { validatePhotos } from "@/lib/estabelecimentos/schema";
import { uploadPhotos } from "@/lib/estabelecimentos/uploadPhotos";

export async function GET() {
  const places = await listPlaces(getSupabaseAdminClient());
  return NextResponse.json(places);
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const fields: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  fields.is_verified = formData.get("is_verified") === "true";
  fields.is_partner = formData.get("is_partner") === "true";

  const parsed = adminPlaceFieldsSchema.safeParse(fields);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ error: "Dados inválidos", fieldErrors }, { status: 400 });
  }

  const photos = formData.getAll("photos").filter((value): value is File => value instanceof File);
  const photoError = validatePhotos(photos);
  if (photoError) {
    return NextResponse.json({ error: photoError }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const photoUrls = await uploadPhotos(supabase, photos);
    const created = await insertPlace(supabase, {
      ...parsed.data,
      photos: photoUrls,
      submission_source: "admin",
      target_profiles: [],
      special_needs_tags: [],
      lat: null,
      lng: null,
      google_place_id: null,
      rating: null,
      notes: null,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Admin place creation failed", error);
    return NextResponse.json({ error: "Não foi possível criar o estabelecimento." }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/admin/places/route.test.ts`
Expected: PASS. If the "literal string false" test fails because `is_partner` came back `true`, check the route uses `formData.get("is_partner") === "true"` (strict equality against the string `"true"`) and not a truthiness check like `Boolean(formData.get("is_partner"))` — a non-empty string `"false"` is truthy in JavaScript.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/places/route.ts src/app/api/admin/places/route.test.ts
git commit -m "feat(admin): add GET/POST /api/admin/places"
```

---

## Task 8: `GET`/`PATCH`/`DELETE /api/admin/places/[id]`

**Files:**
- Create: `src/app/api/admin/places/[id]/route.ts`
- Test: `src/app/api/admin/places/[id]/route.test.ts`

**Interfaces:**
- Consumes: `getPlaceById`, `updatePlace`, `deletePlace` from `@/lib/supabase/queries` (Task 2); `adminPlacePatchSchema` from `@/lib/estabelecimentos/adminSchema` (Task 4).
- Produces: `GET`, `PATCH`, `DELETE` handlers. No other task imports these directly.

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/admin/places/[id]/route.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({
  getPlaceById: vi.fn(),
  updatePlace: vi.fn(),
  deletePlace: vi.fn(),
}));

import { GET, PATCH, DELETE } from "./route";
import { getPlaceById, updatePlace, deletePlace } from "@/lib/supabase/queries";

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/admin/places/p1", { method: "PATCH", body: JSON.stringify(body) }) as never;
}

describe("GET /api/admin/places/[id]", () => {
  it("returns the place when found", async () => {
    vi.mocked(getPlaceById).mockResolvedValue({ id: "p1", name: "JJR" } as never);
    const response = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(200);
  });

  it("returns 404 when not found", async () => {
    vi.mocked(getPlaceById).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/admin/places/[id]", () => {
  it("accepts a partial payload with only is_verified, for the quick-approve action", async () => {
    vi.mocked(updatePlace).mockResolvedValue({ id: "p1", is_verified: true } as never);
    const response = await PATCH(patchRequest({ is_verified: true }), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(200);
    expect(updatePlace).toHaveBeenCalledWith(expect.anything(), "p1", { is_verified: true });
  });

  it("returns 400 with field errors when a present field is invalid, without updating", async () => {
    const response = await PATCH(patchRequest({ partner_status: "vip" }), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(400);
    expect(updatePlace).not.toHaveBeenCalled();
  });

  it("returns 502 when the update itself fails", async () => {
    vi.mocked(updatePlace).mockRejectedValue(new Error("db down"));
    const response = await PATCH(patchRequest({ is_verified: true }), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(502);
  });
});

describe("DELETE /api/admin/places/[id]", () => {
  it("deletes the place and returns ok", async () => {
    vi.mocked(deletePlace).mockResolvedValue(undefined);
    const response = await DELETE(new Request("http://localhost/x"), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(200);
  });

  it("returns ok even when the id doesn't match any row (idempotent delete)", async () => {
    vi.mocked(deletePlace).mockResolvedValue(undefined);
    const response = await DELETE(new Request("http://localhost/x"), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(200);
  });

  it("returns 502 when the delete call itself fails", async () => {
    vi.mocked(deletePlace).mockRejectedValue(new Error("db down"));
    const response = await DELETE(new Request("http://localhost/x"), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "src/app/api/admin/places/[id]/route.test.ts"`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/admin/places/[id]/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getPlaceById, updatePlace, deletePlace } from "@/lib/supabase/queries";
import { adminPlacePatchSchema } from "@/lib/estabelecimentos/adminSchema";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const place = await getPlaceById(getSupabaseAdminClient(), id);
  if (!place) {
    return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 });
  }
  return NextResponse.json(place);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const parsed = adminPlacePatchSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ error: "Dados inválidos", fieldErrors }, { status: 400 });
  }

  try {
    const updated = await updatePlace(getSupabaseAdminClient(), id, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Admin place update failed", error);
    return NextResponse.json({ error: "Não foi possível salvar as alterações." }, { status: 502 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await deletePlace(getSupabaseAdminClient(), id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin place deletion failed", error);
    return NextResponse.json({ error: "Não foi possível excluir o estabelecimento." }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "src/app/api/admin/places/[id]/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/places/[id]/route.ts" "src/app/api/admin/places/[id]/route.test.ts"
git commit -m "feat(admin): add GET/PATCH/DELETE /api/admin/places/[id]"
```

---

## Task 9: `POST /api/admin/places/[id]/photos`

**Files:**
- Create: `src/app/api/admin/places/[id]/photos/route.ts`
- Test: `src/app/api/admin/places/[id]/photos/route.test.ts`

**Interfaces:**
- Consumes: `getPlaceById`, `updatePlace` from `@/lib/supabase/queries` (Task 2); `validatePhotos`, `MAX_PHOTOS` from `@/lib/estabelecimentos/schema`; `uploadPhotos` from `@/lib/estabelecimentos/uploadPhotos` (Task 1).
- Produces: `POST` handler returning the updated `Place` (with its merged `photos[]`). Task 12's form calls this over HTTP.

Uses real `File`/`FormData` objects — add `// @vitest-environment node` (same reason as Task 7).

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/admin/places/[id]/photos/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({ getPlaceById: vi.fn(), updatePlace: vi.fn() }));
vi.mock("@/lib/estabelecimentos/uploadPhotos", () => ({ uploadPhotos: vi.fn() }));

import { POST } from "./route";
import { getPlaceById, updatePlace } from "@/lib/supabase/queries";
import { uploadPhotos } from "@/lib/estabelecimentos/uploadPhotos";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "src/app/api/admin/places/[id]/photos/route.test.ts"`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/admin/places/[id]/photos/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getPlaceById, updatePlace } from "@/lib/supabase/queries";
import { validatePhotos, MAX_PHOTOS } from "@/lib/estabelecimentos/schema";
import { uploadPhotos } from "@/lib/estabelecimentos/uploadPhotos";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const photos = formData.getAll("photos").filter((value): value is File => value instanceof File);
  const photoError = validatePhotos(photos);
  if (photoError) {
    return NextResponse.json({ error: photoError }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const place = await getPlaceById(supabase, id);
  if (!place) {
    return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 });
  }

  if (place.photos.length + photos.length > MAX_PHOTOS) {
    return NextResponse.json(
      { error: `Esse estabelecimento já tem ${place.photos.length} foto(s); no máximo ${MAX_PHOTOS} no total.` },
      { status: 400 },
    );
  }

  try {
    const newUrls = await uploadPhotos(supabase, photos);
    const updated = await updatePlace(supabase, id, { photos: [...place.photos, ...newUrls] });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Admin photo upload failed", error);
    return NextResponse.json({ error: "Não foi possível enviar as fotos." }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "src/app/api/admin/places/[id]/photos/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/places/[id]/photos/route.ts" "src/app/api/admin/places/[id]/photos/route.test.ts"
git commit -m "feat(admin): add incremental photo upload for an existing place"
```

---

## Task 10: `/admin/login` page

**Files:**
- Create: `src/app/admin/login/page.tsx`
- Test: `src/app/admin/login/page.test.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/Button`; calls `POST /api/admin/login` (Task 5) over HTTP.
- Produces: default-exported `AdminLoginPage`. No other task imports this.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/admin/login/page.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import AdminLoginPage from "./page";

describe("AdminLoginPage", () => {
  beforeEach(() => {
    push.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("redirects to /admin on a successful login", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    render(<AdminLoginPage />);
    fireEvent.change(screen.getByPlaceholderText("Senha"), { target: { value: "correct" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
  });

  it("shows an error and does not redirect on a failed login", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    render(<AdminLoginPage />);
    fireEvent.change(screen.getByPlaceholderText("Senha"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => expect(screen.getByText(/senha incorreta/i)).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/admin/login/page.test.tsx`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/admin/login/page.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError("Senha incorreta.");
        return;
      }
      router.push("/admin");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-sand p-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="font-display text-2xl font-extrabold text-teal-ink">Painel administrativo</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          className="w-full rounded-pill border border-teal-ink/15 bg-white px-4 py-3 text-sm text-teal-ink placeholder:text-teal-ink/40"
        />
        {error && <p className="text-sm text-coral">{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/admin/login/page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/login/page.tsx src/app/admin/login/page.test.tsx
git commit -m "feat(admin): add login page"
```

---

## Task 11: `/admin` list page with tabs and quick actions

**Files:**
- Create: `src/components/admin/PlacesTabs.tsx`
- Test: `src/components/admin/PlacesTabs.test.tsx`
- Create: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `Place` type from `@/lib/supabase/types`; `Button` from `@/components/ui/Button`; calls `PATCH`/`DELETE /api/admin/places/[id]` (Task 8) over HTTP.
- Produces: `PlacesTabs({ initialPlaces: Place[] })` component. `src/app/admin/page.tsx` (a thin server component fetching data and rendering `<PlacesTabs>`) consumes it; no automated test for `page.tsx` itself, matching this codebase's existing convention of not directly testing thin server-component route files (e.g. `src/app/roteiro/[slug]/page.tsx` has none either) — all real behavior lives in, and is tested through, `PlacesTabs`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/admin/PlacesTabs.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlacesTabs } from "./PlacesTabs";
import type { Place } from "@/lib/supabase/types";

function place(overrides: Partial<Place>): Place {
  return {
    id: "1", region: "Sul", neighborhood: "Campeche", name: "Lugar", category: "Praia",
    target_profiles: [], price_range: "Gratuito", point_type: "Ponto Turístico", short_description: "",
    address: "", opening_hours: null, phone: null, instagram: null, notes: null, google_place_id: null,
    lat: null, lng: null, rating: null, photos: [], is_partner: false, partner_plan: null,
    partner_offer: null, partner_status: null, special_needs_tags: [], is_verified: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
});

describe("PlacesTabs", () => {
  it("defaults to the Pendentes tab, showing only unverified places", () => {
    const places = [
      place({ id: "a", name: "Pendente", is_verified: false }),
      place({ id: "b", name: "Aprovado", is_verified: true }),
    ];
    render(<PlacesTabs initialPlaces={places} />);
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(screen.queryByText("Aprovado")).not.toBeInTheDocument();
  });

  it("switches tabs on click", () => {
    const places = [
      place({ id: "a", name: "Pendente", is_verified: false }),
      place({ id: "b", name: "Aprovado", is_verified: true }),
    ];
    render(<PlacesTabs initialPlaces={places} />);
    fireEvent.click(screen.getByRole("button", { name: /aprovados/i }));
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
    expect(screen.queryByText("Pendente")).not.toBeInTheDocument();
  });

  it("approving a pending place moves it out of the Pendentes tab", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const places = [place({ id: "a", name: "Pendente", is_verified: false })];
    render(<PlacesTabs initialPlaces={places} />);
    fireEvent.click(screen.getByRole("button", { name: /^aprovar$/i }));
    await waitFor(() => expect(screen.queryByText("Pendente")).not.toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/api/admin/places/a", expect.objectContaining({ method: "PATCH" }));
  });

  it("deleting a place removes it from the list after confirmation", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const places = [place({ id: "a", name: "Aprovado", is_verified: true })];
    render(<PlacesTabs initialPlaces={places} />);
    fireEvent.click(screen.getByRole("button", { name: /aprovados/i }));
    fireEvent.click(screen.getByRole("button", { name: /excluir/i }));
    await waitFor(() => expect(screen.queryByText("Aprovado")).not.toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/api/admin/places/a", expect.objectContaining({ method: "DELETE" }));
  });

  it("does not delete when the confirmation is declined", async () => {
    vi.mocked(confirm).mockReturnValue(false);
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const places = [place({ id: "a", name: "Aprovado", is_verified: true })];
    render(<PlacesTabs initialPlaces={places} />);
    fireEvent.click(screen.getByRole("button", { name: /aprovados/i }));
    fireEvent.click(screen.getByRole("button", { name: /excluir/i }));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/PlacesTabs.test.tsx`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/admin/PlacesTabs.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { Place } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";

type Tab = "pendentes" | "aprovados" | "parceiros" | "todos";

const TABS: { value: Tab; label: string }[] = [
  { value: "pendentes", label: "Pendentes" },
  { value: "aprovados", label: "Aprovados" },
  { value: "parceiros", label: "Parceiros" },
  { value: "todos", label: "Todos" },
];

function matchesTab(place: Place, tab: Tab): boolean {
  if (tab === "todos") return true;
  if (tab === "pendentes") return !place.is_verified;
  if (tab === "parceiros") return place.is_partner;
  return place.is_verified && !place.is_partner;
}

export function PlacesTabs({ initialPlaces }: { initialPlaces: Place[] }) {
  const [places, setPlaces] = useState(initialPlaces);
  const [tab, setTab] = useState<Tab>("pendentes");

  async function handleApprove(id: string) {
    const response = await fetch(`/api/admin/places/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_verified: true }),
    });
    if (!response.ok) return;
    setPlaces((current) => current.map((p) => (p.id === id ? { ...p, is_verified: true } : p)));
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esse estabelecimento? Essa ação não pode ser desfeita.")) return;
    const response = await fetch(`/api/admin/places/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    setPlaces((current) => current.filter((p) => p.id !== id));
  }

  const visible = places.filter((p) => matchesTab(p, tab));

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded-pill px-4 py-2 text-sm font-bold ${
              tab === t.value ? "bg-teal-ink text-sand" : "bg-white text-teal-ink/60"
            }`}
          >
            {t.label} ({places.filter((p) => matchesTab(p, t.value)).length})
          </button>
        ))}
      </div>
      <Link href="/admin/estabelecimentos/novo">
        <Button type="button">Novo estabelecimento</Button>
      </Link>
      <div className="flex flex-col gap-3">
        {visible.length === 0 && <p className="text-sm text-teal-ink/60">Nada por aqui.</p>}
        {visible.map((place) => (
          <div
            key={place.id}
            className="flex items-center justify-between rounded-card border border-teal-ink/10 bg-white p-4"
          >
            <div>
              <p className="font-bold text-teal-ink">{place.name}</p>
              <p className="text-xs text-teal-ink/60">
                {place.category} · {place.neighborhood}, {place.region}
              </p>
            </div>
            <div className="flex gap-2">
              {!place.is_verified && (
                <button
                  type="button"
                  onClick={() => handleApprove(place.id)}
                  className="rounded-pill bg-turquoise/20 px-3 py-1 text-xs font-bold text-turquoise-deep"
                >
                  Aprovar
                </button>
              )}
              <Link
                href={`/admin/estabelecimentos/${place.id}`}
                className="rounded-pill bg-teal-ink/10 px-3 py-1 text-xs font-bold text-teal-ink"
              >
                Editar
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(place.id)}
                className="rounded-pill bg-coral/10 px-3 py-1 text-xs font-bold text-coral-deep"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// src/app/admin/page.tsx
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { listPlaces } from "@/lib/supabase/queries";
import { PlacesTabs } from "@/components/admin/PlacesTabs";

export default async function AdminPage() {
  const places = await listPlaces(getSupabaseAdminClient());
  return (
    <main className="min-h-dvh bg-sand p-6 text-teal-ink">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-extrabold text-teal-ink">Estabelecimentos</h1>
        <PlacesTabs initialPlaces={places} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/PlacesTabs.test.tsx`
Expected: PASS. If the "Aprovar" button's regex accidentally also matches the "Aprovados" tab label, note the test uses `/^aprovar$/i` (anchored) specifically to avoid that ambiguity — keep that anchoring if you adjust either label.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/PlacesTabs.tsx src/components/admin/PlacesTabs.test.tsx src/app/admin/page.tsx
git commit -m "feat(admin): add the places list page with tabs and quick actions"
```

---

## Task 12: `AdminPlaceForm` — shared create/edit form, and its two pages

**Files:**
- Create: `src/components/admin/AdminPlaceForm.tsx`
- Test: `src/components/admin/AdminPlaceForm.test.tsx`
- Create: `src/app/admin/estabelecimentos/novo/page.tsx`
- Create: `src/app/admin/estabelecimentos/[id]/page.tsx`

**Interfaces:**
- Consumes: `adminPlaceFieldsSchema`, `PARTNER_STATUS_OPTIONS`, `AdminPlaceFields` from `@/lib/estabelecimentos/adminSchema` (Task 4); `CATEGORY_OPTIONS`, `REGION_OPTIONS`, `PRICE_RANGE_OPTIONS`, `validatePhotos` from `@/lib/estabelecimentos/schema`; `Place` from `@/lib/supabase/types`; `Button` from `@/components/ui/Button`; calls `POST /api/admin/places` (Task 7), `PATCH /api/admin/places/[id]` (Task 8), and `POST /api/admin/places/[id]/photos` (Task 9) over HTTP.
- Produces: `AdminPlaceForm({ mode: "create" } | { mode: "edit"; place: Place })`. The two page files below are its only consumers; like Task 11's `page.tsx`, they are thin server-component wrappers with no dedicated test — `AdminPlaceForm` carries all the tested behavior.

This test renders with React Testing Library (needs jsdom for `document`) but also exercises code paths that build a real `FormData` with a real `File` (the same jsdom webidl bug from Tasks 7/9) — and unlike those route tests, this one can't just switch to `// @vitest-environment node`, because `render()` needs a DOM. Work around it by stubbing `globalThis.FormData` with a minimal fake for this file only (`vi.stubGlobal("FormData", FakeFormData)` in `beforeEach`, `vi.unstubAllGlobals()` in `afterEach`) — jsdom keeps providing `document` for rendering, while the fake sidesteps its buggy `FormData.append(File)` check. This has no effect on what ships to users: the real browser's real `FormData` is what actually runs in production.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/admin/AdminPlaceForm.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AdminPlaceForm } from "./AdminPlaceForm";
import type { Place } from "@/lib/supabase/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

class FakeFormData {
  entriesList: [string, unknown][] = [];
  append(key: string, value: unknown) {
    this.entriesList.push([key, value]);
  }
  get(key: string) {
    return this.entriesList.find(([k]) => k === key)?.[1];
  }
}

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: "p1", region: "Sul", neighborhood: "Campeche", name: "JJR Surfe Coach", category: "Esporte",
    target_profiles: [], price_range: "R$", point_type: "Aula de Surf", short_description: "Aulas de surf.",
    address: "Servidão A", opening_hours: "Seg a Seg", phone: "(48) 99828-2601", instagram: "@surfcoachjjr",
    notes: null, google_place_id: null, lat: null, lng: null, rating: null,
    photos: ["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"],
    is_partner: true, partner_plan: "Mensal", partner_offer: null, partner_status: "cortesia",
    special_needs_tags: [], is_verified: false, created_at: "2026-01-01T00:00:00Z",
    contact_name: null, contact_email: null, contact_phone: null, submission_source: "self_signup",
    ...overrides,
  };
}

beforeEach(() => {
  push.mockClear();
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("FormData", FakeFormData);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminPlaceForm (create mode)", () => {
  it("does not submit when required fields are empty", async () => {
    render(<AdminPlaceForm mode="create" />);
    fireEvent.click(screen.getByRole("button", { name: /criar estabelecimento/i }));
    await waitFor(() => expect(fetch).not.toHaveBeenCalled());
  });

  it("posts a multipart request and redirects to the new place's edit page on success", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ id: "new-1" }) } as Response);
    render(<AdminPlaceForm mode="create" />);
    fireEvent.change(screen.getByPlaceholderText("Nome do estabelecimento"), { target: { value: "Novo Bar" } });
    fireEvent.change(screen.getByPlaceholderText(/tipo \(ex/i), { target: { value: "Bar" } });
    fireEvent.change(screen.getByPlaceholderText("Descrição"), {
      target: { value: "Um bar bem legal na beira da praia." },
    });
    fireEvent.change(screen.getByPlaceholderText("Bairro"), { target: { value: "Campeche" } });
    fireEvent.change(screen.getByPlaceholderText("Endereço completo"), { target: { value: "Rua X" } });
    fireEvent.change(screen.getByPlaceholderText("Telefone"), { target: { value: "(48) 90000-0000" } });
    fireEvent.change(screen.getByPlaceholderText(/ex: seg a sáb/i), { target: { value: "Todo dia" } });
    fireEvent.click(screen.getByRole("button", { name: /criar estabelecimento/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/estabelecimentos/new-1"));
    expect(fetch).toHaveBeenCalledWith("/api/admin/places", expect.objectContaining({ method: "POST" }));
  });
});

describe("AdminPlaceForm (edit mode)", () => {
  it("prefills fields from the given place", () => {
    render(<AdminPlaceForm mode="edit" place={place()} />);
    expect(screen.getByPlaceholderText("Nome do estabelecimento")).toHaveValue("JJR Surfe Coach");
  });

  it("shows the partner sub-fields only while is_partner is checked", () => {
    render(<AdminPlaceForm mode="edit" place={place({ is_partner: false })} />);
    expect(screen.queryByPlaceholderText(/plano \(ex/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/é parceiro/i));
    expect(screen.getByPlaceholderText(/plano \(ex/i)).toBeInTheDocument();
  });

  it("removing an existing photo excludes it from the save payload", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    render(<AdminPlaceForm mode="edit" place={place()} />);
    fireEvent.click(screen.getAllByLabelText(/remover foto/i)[0]);
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/admin/places/p1", expect.objectContaining({ method: "PATCH" })),
    );
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options!.body as string);
    expect(body.photos).toEqual(["https://cdn.test/b.jpg"]);
  });

  it("selecting a new photo file uploads it immediately to the place's photos endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ photos: ["https://cdn.test/a.jpg", "https://cdn.test/b.jpg", "https://cdn.test/c.jpg"] }),
    } as Response);
    render(<AdminPlaceForm mode="edit" place={place()} />);
    const file = new File([new Uint8Array(10)], "c.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/admin/places/p1/photos", expect.objectContaining({ method: "POST" })),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/AdminPlaceForm.test.tsx`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/admin/AdminPlaceForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  adminPlaceFieldsSchema,
  PARTNER_STATUS_OPTIONS,
  type AdminPlaceFields,
} from "@/lib/estabelecimentos/adminSchema";
import { CATEGORY_OPTIONS, REGION_OPTIONS, PRICE_RANGE_OPTIONS, validatePhotos } from "@/lib/estabelecimentos/schema";
import type { Place } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";

const inputClass =
  "w-full rounded-pill border border-teal-ink/15 bg-white px-4 py-3 text-sm text-teal-ink placeholder:text-teal-ink/40";
const textareaClass =
  "w-full rounded-card border border-teal-ink/15 bg-white px-4 py-3 text-sm text-teal-ink placeholder:text-teal-ink/40";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-coral">{message}</p>;
}

type FormInput = z.input<typeof adminPlaceFieldsSchema>;

function defaultsFor(place?: Place): FormInput {
  if (!place) {
    return {
      name: "", category: CATEGORY_OPTIONS[0], point_type: "", short_description: "",
      region: REGION_OPTIONS[0], neighborhood: "", address: "", price_range: PRICE_RANGE_OPTIONS[0],
      opening_hours: "", phone: "", instagram: "", contact_name: "", contact_email: "", contact_phone: "",
      is_verified: false, is_partner: false, partner_status: "", partner_plan: "", partner_offer: "",
    };
  }
  return {
    name: place.name, category: place.category, point_type: place.point_type,
    short_description: place.short_description, region: place.region, neighborhood: place.neighborhood,
    address: place.address, price_range: place.price_range, opening_hours: place.opening_hours ?? "",
    phone: place.phone ?? "", instagram: place.instagram ?? "", contact_name: place.contact_name ?? "",
    contact_email: place.contact_email ?? "", contact_phone: place.contact_phone ?? "",
    is_verified: place.is_verified, is_partner: place.is_partner,
    partner_status: place.partner_status ?? "", partner_plan: place.partner_plan ?? "",
    partner_offer: place.partner_offer ?? "",
  };
}

type Props = { mode: "create" } | { mode: "edit"; place: Place };

export function AdminPlaceForm(props: Props) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormInput, unknown, AdminPlaceFields>({
    resolver: zodResolver(adminPlaceFieldsSchema),
    defaultValues: defaultsFor(props.mode === "edit" ? props.place : undefined),
  });

  const [photos, setPhotos] = useState<string[]>(props.mode === "edit" ? props.place.photos : []);
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isPartner = watch("is_partner");

  async function handleAddPhotos(files: File[]) {
    const error = validatePhotos(props.mode === "create" ? [...newPhotoFiles, ...files] : files);
    if (error) {
      setPhotoError(error);
      return;
    }
    setPhotoError(null);
    if (props.mode === "create") {
      setNewPhotoFiles((current) => [...current, ...files]);
      return;
    }
    const formData = new FormData();
    for (const file of files) formData.append("photos", file);
    const response = await fetch(`/api/admin/places/${props.place.id}/photos`, { method: "POST", body: formData });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setPhotoError(body?.error ?? "Não foi possível enviar as fotos.");
      return;
    }
    const updated = await response.json();
    setPhotos(updated.photos);
  }

  function removeExistingPhoto(url: string) {
    setPhotos((current) => current.filter((p) => p !== url));
  }

  async function onSubmit(values: AdminPlaceFields) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (props.mode === "create") {
        const formData = new FormData();
        for (const [key, value] of Object.entries(values)) {
          formData.append(key, typeof value === "boolean" ? String(value) : (value as string));
        }
        for (const file of newPhotoFiles) formData.append("photos", file);
        const response = await fetch("/api/admin/places", { method: "POST", body: formData });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setSubmitError(body?.error ?? "Não foi possível criar o estabelecimento.");
          return;
        }
        const created = await response.json();
        router.push(`/admin/estabelecimentos/${created.id}`);
      } else {
        const response = await fetch(`/api/admin/places/${props.place.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, photos }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setSubmitError(body?.error ?? "Não foi possível salvar.");
          return;
        }
        router.push("/admin");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-teal-ink">Sobre o negócio</h2>
        <input {...register("name")} placeholder="Nome do estabelecimento" className={inputClass} />
        <FieldError message={errors.name?.message} />

        <select {...register("category")} className={inputClass}>
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <FieldError message={errors.category?.message} />

        <input {...register("point_type")} placeholder="Tipo (ex: Restaurante, Pousada, Bar)" className={inputClass} />
        <FieldError message={errors.point_type?.message} />

        <select {...register("price_range")} className={inputClass}>
          {PRICE_RANGE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <FieldError message={errors.price_range?.message} />

        <textarea {...register("short_description")} placeholder="Descrição" rows={3} className={textareaClass} />
        <FieldError message={errors.short_description?.message} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-teal-ink">Localização e contato</h2>
        <select {...register("region")} className={inputClass}>
          {REGION_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <FieldError message={errors.region?.message} />

        <input {...register("neighborhood")} placeholder="Bairro" className={inputClass} />
        <FieldError message={errors.neighborhood?.message} />

        <input {...register("address")} placeholder="Endereço completo" className={inputClass} />
        <FieldError message={errors.address?.message} />

        <input {...register("phone")} placeholder="Telefone" className={inputClass} />
        <FieldError message={errors.phone?.message} />

        <input {...register("instagram")} placeholder="@instagram" className={inputClass} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-teal-ink">Horário de funcionamento</h2>
        <input {...register("opening_hours")} placeholder="Ex: Seg a Sáb, 9h às 18h" className={inputClass} />
        <FieldError message={errors.opening_hours?.message} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-teal-ink">Aprovação</h2>
        <label className="flex items-center gap-2 text-sm text-teal-ink">
          <input type="checkbox" {...register("is_verified")} />
          Aprovado (visível no site)
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-teal-ink">Parceria</h2>
        <label className="flex items-center gap-2 text-sm text-teal-ink">
          <input type="checkbox" {...register("is_partner")} />
          É parceiro
        </label>
        {isPartner && (
          <>
            <select {...register("partner_status")} className={inputClass}>
              {PARTNER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input {...register("partner_plan")} placeholder="Plano (ex: Mensal)" className={inputClass} />
            <textarea
              {...register("partner_offer")}
              placeholder="Promoção exibida no site"
              rows={2}
              className={textareaClass}
            />
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-teal-ink">Fotos</h2>
        {props.mode === "edit" && (
          <div className="flex flex-wrap gap-2">
            {photos.map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-20 w-20 rounded-card object-cover" />
                <button
                  type="button"
                  onClick={() => removeExistingPhoto(url)}
                  aria-label="Remover foto"
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-coral text-xs text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {props.mode === "create" && newPhotoFiles.length > 0 && (
          <p className="text-xs text-teal-ink/60">{newPhotoFiles.length} foto(s) selecionada(s)</p>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => handleAddPhotos(Array.from(e.target.files ?? []))}
        />
        <FieldError message={photoError ?? undefined} />
      </section>

      {submitError && <p className="text-sm text-coral">{submitError}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Salvando..." : props.mode === "create" ? "Criar estabelecimento" : "Salvar alterações"}
      </Button>
    </form>
  );
}
```

```tsx
// src/app/admin/estabelecimentos/novo/page.tsx
import { AdminPlaceForm } from "@/components/admin/AdminPlaceForm";

export default function NovoEstabelecimentoPage() {
  return (
    <main className="min-h-dvh bg-sand p-6 text-teal-ink">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-2xl font-extrabold text-teal-ink">Novo estabelecimento</h1>
        <AdminPlaceForm mode="create" />
      </div>
    </main>
  );
}
```

```tsx
// src/app/admin/estabelecimentos/[id]/page.tsx
import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getPlaceById } from "@/lib/supabase/queries";
import { AdminPlaceForm } from "@/components/admin/AdminPlaceForm";

export default async function EditarEstabelecimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const place = await getPlaceById(getSupabaseAdminClient(), id);
  if (!place) notFound();
  return (
    <main className="min-h-dvh bg-sand p-6 text-teal-ink">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-2xl font-extrabold text-teal-ink">Editar estabelecimento</h1>
        <AdminPlaceForm mode="edit" place={place} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/AdminPlaceForm.test.tsx`
Expected: PASS. If the photo-upload tests throw a webidl/`File` error, confirm `vi.stubGlobal("FormData", FakeFormData)` runs in `beforeEach` *before* `render()` — the component must see the fake when it constructs its own `FormData`, not the real jsdom one.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS across the whole repo.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AdminPlaceForm.tsx src/components/admin/AdminPlaceForm.test.tsx src/app/admin/estabelecimentos/novo/page.tsx "src/app/admin/estabelecimentos/[id]/page.tsx"
git commit -m "feat(admin): add the create/edit establishment form and its pages"
```

---

## Task 13: Manual deployment step — set `ADMIN_PASSWORD` and smoke-test

This task has no automated test — it's the checklist for turning the panel on for real, the same kind of manual step the README already lists for other environment variables.

- [ ] **Step 1: Choose and set a real password locally**

In `.env.local`, add a line: `ADMIN_PASSWORD=<a real password you choose>` (not the placeholder from `.env.local.example`). Restart the dev server so it picks up the new env var.

- [ ] **Step 2: Set the same variable wherever this app is deployed**

Whatever hosting provider runs the production build (check the project's deploy target — e.g. Vercel's dashboard → Project → Settings → Environment Variables) needs `ADMIN_PASSWORD` set there too, with its own value (can be the same as local or different — your choice). If this step is skipped, the panel fails safely rather than crashing: `isCorrectAdminPassword`/`isValidAdminSession` (Task 3) return `false` when the variable is missing, so login just always shows "Senha incorreta." and the panel stays inaccessible until the variable is set — no stack trace, no 500.

- [ ] **Step 3: Smoke-test the whole flow locally**

With `npm run dev` running:
1. Visit `/admin` directly — confirm it redirects to `/admin/login`.
2. Log in with the wrong password — confirm it shows "Senha incorreta." and stays on the login page.
3. Log in with the correct password — confirm it lands on `/admin` and shows the Pendentes tab.
4. If there's a real pending self-signup row (e.g. from testing the earlier feature), click "Aprovar" — confirm it disappears from Pendentes.
5. Click "Novo estabelecimento", fill the form with a throwaway test listing plus one photo, submit — confirm it redirects to that listing's edit page and the photo appears as a thumbnail.
6. On that same edit page, remove the photo, add a different one, toggle "É parceiro" on, fill a promoção, and save — confirm the change persists (reload the page and check).
7. Delete that throwaway test listing — confirm it's gone from the list and (optionally) from Supabase's Table Editor.
