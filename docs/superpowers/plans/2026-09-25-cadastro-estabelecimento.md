# Cadastro de Estabelecimento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an establishment owner submit their business through a public form at `/parceiros/cadastro`, landing as an unverified row in the existing `places` table for the team to review and approve in Supabase Studio.

**Architecture:** A single-page React Hook Form + Zod form posts `multipart/form-data` to a new `POST /api/estabelecimentos` route. The route delegates to a `submitEstablishment` orchestrator (mirroring the existing `createItinerary` pattern) that validates fields and photos, uploads photos to a new public-read Supabase Storage bucket, and inserts a `places` row with `is_verified: false`. No authentication, no admin UI, no payment integration — all explicitly out of scope per the spec.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Zod (already a dependency), `react-hook-form` + `@hookform/resolvers` (new), `@supabase/supabase-js` (already a dependency), Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-09-25-cadastro-estabelecimento-design.md](../specs/2026-09-25-cadastro-estabelecimento-design.md)

## Global Constraints

- No authentication/login is added anywhere (spec non-goal — the app has none today).
- No admin UI is added — review/approval happens in the Supabase Table Editor.
- `partner_plan`, `partner_offer`, `partner_status` are left `null` on insert — untouched by this feature.
- No email notifications are sent on submission.
- `lat`, `lng`, `google_place_id`, `rating` are left `null` on insert — no geocoding in this feature.
- The `establishment-photos` Storage bucket must be created **public for reading**; uploads only ever happen server-side via `getSupabaseAdminClient()` — never from the browser.
- No new environment variables are required — reuse `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` via `getSupabaseAdminClient()`.
- New `places` columns (`contact_name`, `contact_email`, `contact_phone`, `submission_source`) must not break any existing `Place`-typed test fixture — make the four new fields optional (`?:`) on the `Place` TypeScript interface even though `submission_source` has a DB-level default, so the many existing `place({...})` test builders across `src/lib/itinerary/*.test.ts` keep compiling without modification.
- `is_verified` on `places` defaults to `true` at the database level (migration `0003`) — every insert in this feature must explicitly pass `is_verified: false`; never rely on the column default.

## Review Focus

- Whitespace-only input in a required text field (e.g. `name: "   "`) must be rejected, not accepted as valid — covered by trimming before `.min()` checks in Task 2, tested in `schema.test.ts`.
- A stale or tampered `category` / `region` / `price_range` value outside the known enum must be rejected with a 400, never silently inserted — tested in `schema.test.ts` and `route.test.ts`.
- Submitting with zero photos must succeed (the spec never requires a minimum) — tested explicitly in `submitEstablishment.test.ts` so this isn't accidentally over-tightened later.
- More than 6 photos, or any single oversized/wrong-type photo, must be rejected *before* any upload call is made — tested in `schema.test.ts` (`validatePhotos`) and `submitEstablishment.test.ts` (asserting `storage.from` is never called).
- A photo upload failing partway through a multi-photo batch (not just the first one) must stop the loop, throw, and never reach the `places` insert — tested in `submitEstablishment.test.ts`.

---

## Task 1: Database schema — migration and type

**Files:**
- Create: `supabase/migrations/0004_add_establishment_signup_fields.sql`
- Modify: `src/lib/supabase/types.ts`

**Interfaces:**
- Produces: `Place` interface gains four new optional fields: `contact_name?: string | null`, `contact_email?: string | null`, `contact_phone?: string | null`, `submission_source?: string`.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0004_add_establishment_signup_fields.sql
alter table places add column contact_name text;
alter table places add column contact_email text;
alter table places add column contact_phone text;
alter table places add column submission_source text not null default 'admin';
```

- [ ] **Step 2: Update the `Place` type**

In `src/lib/supabase/types.ts`, add the four new fields to the `Place` interface (as optional, per the Global Constraints note above — this keeps every existing `place({...})` test fixture across the codebase compiling without changes):

```ts
export interface Place {
  id: string;
  region: string;
  neighborhood: string;
  name: string;
  category: string;
  target_profiles: string[];
  price_range: "Gratuito" | "R$" | "R$$" | "R$$$";
  point_type: string;
  short_description: string;
  address: string;
  opening_hours: string | null;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
  google_place_id: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  photos: string[];
  is_partner: boolean;
  partner_plan: string | null;
  partner_offer: string | null;
  partner_status: string | null;
  special_needs_tags: string[];
  is_verified: boolean;
  created_at: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  submission_source?: string;
}
```

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: all existing tests still PASS (the new fields are optional, so no fixture needs updating).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_add_establishment_signup_fields.sql src/lib/supabase/types.ts
git commit -m "feat(db): add establishment self-signup contact columns to places"
```

---

## Task 2: Validation schema and photo rules

**Files:**
- Create: `src/lib/estabelecimentos/schema.ts`
- Test: `src/lib/estabelecimentos/schema.test.ts`

**Interfaces:**
- Consumes: `CATEGORY_STYLES` from `src/lib/itinerary/mapIcons.ts` (`Record<string, CategoryStyle>` — its keys are the valid category values).
- Produces: `CATEGORY_OPTIONS: readonly string[]`, `REGION_OPTIONS: readonly ["Sul","Leste","Norte","Centro","Universitário"]`, `PRICE_RANGE_OPTIONS: readonly ["Gratuito","R$","R$$","R$$$"]`, `establishmentFieldsSchema: ZodObject`, `type EstablishmentFields = z.infer<typeof establishmentFieldsSchema>`, `MAX_PHOTOS = 6`, `MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024`, `ALLOWED_PHOTO_TYPES: string[]`, `validatePhotos(photos: File[]): string | null`. Task 4, 6, and 7 all import from this file.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/estabelecimentos/schema.test.ts
import { describe, it, expect } from "vitest";
import { establishmentFieldsSchema, validatePhotos, MAX_PHOTOS, MAX_PHOTO_SIZE_BYTES } from "./schema";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Bar do Zé",
    category: "Bar / Noturno",
    point_type: "Bar",
    short_description: "Bar de esquina com música ao vivo às sextas.",
    region: "Sul",
    neighborhood: "Campeche",
    address: "Rua das Gaivotas, 123",
    price_range: "R$$",
    opening_hours: "Ter a Dom, 18h às 0h",
    phone: "(48) 99999-0000",
    instagram: "@bardoze",
    contact_name: "José Silva",
    contact_email: "jose@example.com",
    contact_phone: "(48) 99999-0001",
    ...overrides,
  };
}

function photo(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("establishmentFieldsSchema", () => {
  it("accepts a fully valid payload", () => {
    const result = establishmentFieldsSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("trims whitespace and rejects a whitespace-only required field", () => {
    const result = establishmentFieldsSchema.safeParse(validPayload({ name: "   " }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).address;
    const result = establishmentFieldsSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid category value", () => {
    const result = establishmentFieldsSchema.safeParse(validPayload({ category: "Não existe" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid region value", () => {
    const result = establishmentFieldsSchema.safeParse(validPayload({ region: "Oeste" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid contact email", () => {
    const result = establishmentFieldsSchema.safeParse(validPayload({ contact_email: "not-an-email" }));
    expect(result.success).toBe(false);
  });

  it("defaults instagram to an empty string when omitted", () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).instagram;
    const result = establishmentFieldsSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.instagram).toBe("");
  });
});

describe("validatePhotos", () => {
  it("allows zero photos", () => {
    expect(validatePhotos([])).toBeNull();
  });

  it("allows up to the maximum number of valid photos", () => {
    const photos = Array.from({ length: MAX_PHOTOS }, (_, i) => photo(`p${i}.jpg`, "image/jpeg", 1024));
    expect(validatePhotos(photos)).toBeNull();
  });

  it("rejects more than the maximum number of photos", () => {
    const photos = Array.from({ length: MAX_PHOTOS + 1 }, (_, i) => photo(`p${i}.jpg`, "image/jpeg", 1024));
    expect(validatePhotos(photos)).not.toBeNull();
  });

  it("rejects an oversized photo", () => {
    const photos = [photo("big.jpg", "image/jpeg", MAX_PHOTO_SIZE_BYTES + 1)];
    expect(validatePhotos(photos)).not.toBeNull();
  });

  it("rejects a disallowed file type", () => {
    const photos = [photo("doc.pdf", "application/pdf", 1024)];
    expect(validatePhotos(photos)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/estabelecimentos/schema.test.ts`
Expected: FAIL with "Cannot find module './schema'" (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/estabelecimentos/schema.ts
import { z } from "zod";
import { CATEGORY_STYLES } from "@/lib/itinerary/mapIcons";

export const CATEGORY_OPTIONS = Object.keys(CATEGORY_STYLES) as [string, ...string[]];
export const REGION_OPTIONS = ["Sul", "Leste", "Norte", "Centro", "Universitário"] as const;
export const PRICE_RANGE_OPTIONS = ["Gratuito", "R$", "R$$", "R$$$"] as const;

function requiredText(min = 1, message = "Campo obrigatório") {
  return z.string().trim().min(min, message);
}

export const establishmentFieldsSchema = z.object({
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
  contact_name: requiredText(),
  contact_email: z.string().trim().email("Email inválido"),
  contact_phone: requiredText(),
});

export type EstablishmentFields = z.infer<typeof establishmentFieldsSchema>;

export const MAX_PHOTOS = 6;
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validatePhotos(photos: File[]): string | null {
  if (photos.length > MAX_PHOTOS) {
    return `Envie no máximo ${MAX_PHOTOS} fotos.`;
  }
  for (const photo of photos) {
    if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) {
      return "As fotos devem estar em formato JPG, PNG ou WEBP.";
    }
    if (photo.size > MAX_PHOTO_SIZE_BYTES) {
      return "Cada foto deve ter no máximo 5MB.";
    }
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/estabelecimentos/schema.test.ts`
Expected: PASS (all cases green). If `z.enum(...)` reports a TypeScript or runtime error about the options shape, confirm `CATEGORY_OPTIONS`/`REGION_OPTIONS`/`PRICE_RANGE_OPTIONS` are non-empty tuples — the `[string, ...string[]]` cast on `CATEGORY_OPTIONS` exists precisely so `z.enum` accepts it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/estabelecimentos/schema.ts src/lib/estabelecimentos/schema.test.ts
git commit -m "feat(estabelecimentos): add submission validation schema"
```

---

## Task 3: `insertPlace` query helper

**Files:**
- Modify: `src/lib/supabase/queries.ts`
- Modify: `src/lib/supabase/queries.test.ts`

**Interfaces:**
- Consumes: `Place` type from `./types` (Task 1).
- Produces: `insertPlace(client: SupabaseClient, row: Omit<Place, "id" | "created_at">): Promise<Place>`. Task 4 calls this.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/supabase/queries.test.ts` (add `insertPlace` to the existing import list at the top, then add this test near the other `insert*` test):

```ts
  it("insertPlace inserts and returns the created row", async () => {
    const row = {
      region: "Sul", neighborhood: "Campeche", name: "Bar do Zé", category: "Bar / Noturno",
      target_profiles: [], price_range: "R$$" as const, point_type: "Bar", short_description: "d",
      address: "Rua X", opening_hours: null, phone: null, instagram: null, notes: null,
      google_place_id: null, lat: null, lng: null, rating: null, photos: [],
      is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
      special_needs_tags: [], is_verified: false, submission_source: "self_signup",
    };
    const created = { id: "1", ...row, created_at: "2026-01-01T00:00:00Z" };
    const client = fakeClientFor("places", makeChain({ data: created, error: null }));
    await expect(insertPlace(client, row)).resolves.toEqual(created);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/supabase/queries.test.ts`
Expected: FAIL with "insertPlace is not defined" / import error.

- [ ] **Step 3: Implement `insertPlace`**

Add to `src/lib/supabase/queries.ts` (place it near `insertItinerary`):

```ts
export async function insertPlace(
  client: SupabaseClient,
  row: Omit<Place, "id" | "created_at">,
): Promise<Place> {
  const { data, error } = await client.from("places").insert(row).select().single();
  if (error) throw error;
  return data as Place;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/supabase/queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries.ts src/lib/supabase/queries.test.ts
git commit -m "feat(supabase): add insertPlace query helper"
```

---

## Task 4: `submitEstablishment` orchestrator

**Files:**
- Create: `src/lib/estabelecimentos/submitEstablishment.ts`
- Test: `src/lib/estabelecimentos/submitEstablishment.test.ts`

**Interfaces:**
- Consumes: `establishmentFieldsSchema`, `validatePhotos` from `./schema` (Task 2); `insertPlace` from `@/lib/supabase/queries` (Task 3).
- Produces: `class InvalidFieldsError extends Error { fieldErrors: Record<string,string> }`, `class InvalidPhotosError extends Error {}`, `submitEstablishment(input: { fields: Record<string, unknown>; photos: File[]; honeypot: string }, deps: { supabase: SupabaseClient }): Promise<{ skipped: boolean }>`. Task 5 (the API route) imports all three.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/estabelecimentos/submitEstablishment.test.ts
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { submitEstablishment, InvalidFieldsError, InvalidPhotosError } from "./submitEstablishment";

function validFields(overrides: Record<string, unknown> = {}) {
  return {
    name: "Bar do Zé", category: "Bar / Noturno", point_type: "Bar",
    short_description: "Bar de esquina com música ao vivo às sextas.",
    region: "Sul", neighborhood: "Campeche", address: "Rua das Gaivotas, 123",
    price_range: "R$$", opening_hours: "Ter a Dom, 18h às 0h", phone: "(48) 99999-0000",
    instagram: "@bardoze", contact_name: "José Silva", contact_email: "jose@example.com",
    contact_phone: "(48) 99999-0001",
    ...overrides,
  };
}

function photo(name: string, type = "image/jpeg", sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

function fakeSupabase(opts: {
  uploadErrorOnCall?: number;
  insertError?: Error;
  insertedRow?: Record<string, unknown>;
} = {}) {
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

  const insertSingle = vi.fn().mockResolvedValue(
    opts.insertError
      ? { data: null, error: opts.insertError }
      : { data: opts.insertedRow ?? { id: "p1" }, error: null },
  );
  const insertChain = { select: () => insertChain, single: insertSingle };
  const from = vi.fn().mockReturnValue({ insert: vi.fn().mockReturnValue(insertChain) });

  return { storage: { from: storageFrom }, from } as unknown as SupabaseClient;
}

describe("submitEstablishment", () => {
  it("skips silently when the honeypot field is filled, touching neither storage nor the database", async () => {
    const supabase = fakeSupabase();
    const result = await submitEstablishment(
      { fields: validFields(), photos: [], honeypot: "i-am-a-bot" },
      { supabase },
    );
    expect(result).toEqual({ skipped: true });
    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("throws InvalidFieldsError with a field map when required data is missing, without touching storage or the database", async () => {
    const supabase = fakeSupabase();
    const fields = validFields();
    delete (fields as Record<string, unknown>).address;
    await expect(
      submitEstablishment({ fields, photos: [], honeypot: "" }, { supabase }),
    ).rejects.toBeInstanceOf(InvalidFieldsError);
    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("throws InvalidPhotosError before uploading anything when there are too many photos", async () => {
    const supabase = fakeSupabase();
    const photos = Array.from({ length: 7 }, (_, i) => photo(`p${i}.jpg`));
    await expect(
      submitEstablishment({ fields: validFields(), photos, honeypot: "" }, { supabase }),
    ).rejects.toBeInstanceOf(InvalidPhotosError);
    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("succeeds with zero photos", async () => {
    const supabase = fakeSupabase();
    const result = await submitEstablishment(
      { fields: validFields(), photos: [], honeypot: "" },
      { supabase },
    );
    expect(result).toEqual({ skipped: false });
    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith("places");
  });

  it("uploads each photo and inserts is_verified/is_partner false with the resulting URLs", async () => {
    const supabase = fakeSupabase();
    const photos = [photo("a.jpg"), photo("b.jpg")];
    await submitEstablishment({ fields: validFields(), photos, honeypot: "" }, { supabase });

    expect(supabase.storage.from).toHaveBeenCalledWith("establishment-photos");
    const fromReturn = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(fromReturn.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        is_verified: false,
        is_partner: false,
        submission_source: "self_signup",
        photos: ["https://cdn.test/path-1", "https://cdn.test/path-2"],
      }),
    );
  });

  it("stops after the second of three photos fails to upload, and never inserts", async () => {
    const supabase = fakeSupabase({ uploadErrorOnCall: 2 });
    const photos = [photo("a.jpg"), photo("b.jpg"), photo("c.jpg")];
    await expect(
      submitEstablishment({ fields: validFields(), photos, honeypot: "" }, { supabase }),
    ).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("propagates an insert failure after photos already uploaded successfully", async () => {
    const supabase = fakeSupabase({ insertError: new Error("db down") });
    await expect(
      submitEstablishment({ fields: validFields(), photos: [photo("a.jpg")], honeypot: "" }, { supabase }),
    ).rejects.toThrow("db down");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/estabelecimentos/submitEstablishment.test.ts`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/estabelecimentos/submitEstablishment.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { establishmentFieldsSchema, validatePhotos } from "./schema";
import { insertPlace } from "@/lib/supabase/queries";

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

const PHOTO_BUCKET = "establishment-photos";

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

async function uploadPhotos(supabase: SupabaseClient, photos: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const photo of photos) {
    const path = `${crypto.randomUUID()}/${photo.name}`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo);
    if (error) throw error;
    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/estabelecimentos/submitEstablishment.test.ts`
Expected: PASS. If the "stops after the second of three photos fails" test shows `supabase.from` was still called, check that the `for` loop's `throw error` actually exits `uploadPhotos` before `submitEstablishment` reaches the `insertPlace` call — no `try/catch` should swallow it in between.

- [ ] **Step 5: Commit**

```bash
git add src/lib/estabelecimentos/submitEstablishment.ts src/lib/estabelecimentos/submitEstablishment.test.ts
git commit -m "feat(estabelecimentos): add submission orchestrator with honeypot and photo upload"
```

---

## Task 5: API route `/api/estabelecimentos`

**Files:**
- Create: `src/app/api/estabelecimentos/route.ts`
- Test: `src/app/api/estabelecimentos/route.test.ts`

**Interfaces:**
- Consumes: `submitEstablishment`, `InvalidFieldsError`, `InvalidPhotosError` from `@/lib/estabelecimentos/submitEstablishment` (Task 4); `getSupabaseAdminClient` from `@/lib/supabase/client`.
- Produces: `POST(request: Request): Promise<Response>` — a Next.js route handler. Task 6's client helper calls this endpoint over HTTP (not by import).

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/estabelecimentos/route.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/estabelecimentos/submitEstablishment", async () => {
  const actual = await vi.importActual<typeof import("@/lib/estabelecimentos/submitEstablishment")>(
    "@/lib/estabelecimentos/submitEstablishment",
  );
  return { ...actual, submitEstablishment: vi.fn() };
});

import { POST } from "./route";
import { submitEstablishment, InvalidFieldsError, InvalidPhotosError } from "@/lib/estabelecimentos/submitEstablishment";

function formRequest(fields: Record<string, string>, photos: File[] = [], honeypot = "") {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.append(key, value);
  formData.append("website", honeypot);
  for (const photo of photos) formData.append("photos", photo);
  return new Request("http://localhost/api/estabelecimentos", { method: "POST", body: formData }) as never;
}

const FIELDS = {
  name: "Bar do Zé", category: "Bar / Noturno", point_type: "Bar",
  short_description: "Bar de esquina com música ao vivo às sextas.",
  region: "Sul", neighborhood: "Campeche", address: "Rua das Gaivotas, 123",
  price_range: "R$$", opening_hours: "Ter a Dom, 18h às 0h", phone: "(48) 99999-0000",
  instagram: "@bardoze", contact_name: "José Silva", contact_email: "jose@example.com",
  contact_phone: "(48) 99999-0001",
};

describe("POST /api/estabelecimentos", () => {
  it("returns 201 on a successful submission", async () => {
    vi.mocked(submitEstablishment).mockResolvedValue({ skipped: false });
    const response = await POST(formRequest(FIELDS));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns 201 even when the submission was silently skipped as spam", async () => {
    vi.mocked(submitEstablishment).mockResolvedValue({ skipped: true });
    const response = await POST(formRequest(FIELDS, [], "bot-value"));
    expect(response.status).toBe(201);
  });

  it("returns 400 with field errors when validation fails", async () => {
    vi.mocked(submitEstablishment).mockRejectedValue(new InvalidFieldsError({ name: "Campo obrigatório" }));
    const response = await POST(formRequest(FIELDS));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Dados inválidos", fieldErrors: { name: "Campo obrigatório" } });
  });

  it("returns 400 when photos are invalid", async () => {
    vi.mocked(submitEstablishment).mockRejectedValue(new InvalidPhotosError("Cada foto deve ter no máximo 5MB."));
    const response = await POST(formRequest(FIELDS));
    expect(response.status).toBe(400);
  });

  it("returns 502 on an unexpected failure", async () => {
    vi.mocked(submitEstablishment).mockRejectedValue(new Error("boom"));
    const response = await POST(formRequest(FIELDS));
    expect(response.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/estabelecimentos/route.test.ts`
Expected: FAIL with a module-not-found error for `./route`.

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/estabelecimentos/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { submitEstablishment, InvalidFieldsError, InvalidPhotosError } from "@/lib/estabelecimentos/submitEstablishment";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const fields: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "website") {
      fields[key] = value;
    }
  }
  const honeypotValue = formData.get("website");
  const honeypot = typeof honeypotValue === "string" ? honeypotValue : "";
  const photos = formData.getAll("photos").filter((value): value is File => value instanceof File);

  try {
    await submitEstablishment({ fields, photos, honeypot }, { supabase: getSupabaseAdminClient() });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidFieldsError) {
      return NextResponse.json({ error: "Dados inválidos", fieldErrors: error.fieldErrors }, { status: 400 });
    }
    if (error instanceof InvalidPhotosError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Establishment submission failed", error);
    return NextResponse.json(
      { error: "Não foi possível enviar seu cadastro agora. Tente novamente." },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/estabelecimentos/route.test.ts`
Expected: PASS. jsdom (the project's test environment) implements `Request`/`FormData`/`File` natively, the same way `src/app/api/itineraries/route.test.ts` already relies on jsdom's `Request` for a JSON body — if `request.formData()` unexpectedly returns empty fields, check the Vitest version's jsdom is recent enough to parse a `FormData` body (already the case at the versions pinned in this repo's `package.json`).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/estabelecimentos/route.ts src/app/api/estabelecimentos/route.test.ts
git commit -m "feat(estabelecimentos): add POST /api/estabelecimentos route"
```

---

## Task 6: Client-side submit helper

**Files:**
- Create: `src/lib/estabelecimentos/submitEstablishmentForm.ts`
- Test: `src/lib/estabelecimentos/submitEstablishmentForm.test.ts`

**Interfaces:**
- Consumes: `EstablishmentFields` type from `./schema` (Task 2).
- Produces: `class EstablishmentSubmissionError extends Error { fieldErrors?: Record<string,string> }`, `submitEstablishmentForm(values: EstablishmentFields, photos: File[], honeypot: string): Promise<void>`. Task 7's page calls this.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/estabelecimentos/submitEstablishmentForm.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitEstablishmentForm, EstablishmentSubmissionError } from "./submitEstablishmentForm";
import type { EstablishmentFields } from "./schema";

const VALUES: EstablishmentFields = {
  name: "Bar do Zé", category: "Bar / Noturno", point_type: "Bar",
  short_description: "Bar de esquina com música ao vivo às sextas.",
  region: "Sul", neighborhood: "Campeche", address: "Rua das Gaivotas, 123",
  price_range: "R$$", opening_hours: "Ter a Dom, 18h às 0h", phone: "(48) 99999-0000",
  instagram: "@bardoze", contact_name: "José Silva", contact_email: "jose@example.com",
  contact_phone: "(48) 99999-0001",
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("submitEstablishmentForm", () => {
  it("posts a FormData body to /api/estabelecimentos and resolves on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    await submitEstablishmentForm(VALUES, [], "");

    expect(fetchMock).toHaveBeenCalledWith("/api/estabelecimentos", expect.objectContaining({ method: "POST" }));
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("name")).toBe("Bar do Zé");
    expect(body.get("website")).toBe("");
  });

  it("throws EstablishmentSubmissionError with fieldErrors on a 400 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Dados inválidos", fieldErrors: { name: "Campo obrigatório" } }),
      }),
    );

    await expect(submitEstablishmentForm(VALUES, [], "")).rejects.toMatchObject({
      message: "Dados inválidos",
      fieldErrors: { name: "Campo obrigatório" },
    });
  });

  it("throws a generic error message on a 502 response with no body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => { throw new Error("no body"); } }));

    await expect(submitEstablishmentForm(VALUES, [], "")).rejects.toBeInstanceOf(EstablishmentSubmissionError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/estabelecimentos/submitEstablishmentForm.test.ts`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/estabelecimentos/submitEstablishmentForm.ts
import type { EstablishmentFields } from "./schema";

export class EstablishmentSubmissionError extends Error {
  fieldErrors?: Record<string, string>;
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

export async function submitEstablishmentForm(
  values: EstablishmentFields,
  photos: File[],
  honeypot: string,
): Promise<void> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.append(key, value as string);
  }
  formData.append("website", honeypot);
  for (const photo of photos) {
    formData.append("photos", photo);
  }

  const response = await fetch("/api/estabelecimentos", { method: "POST", body: formData });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new EstablishmentSubmissionError(
      body?.error ?? "Não foi possível enviar seu cadastro. Tente novamente em instantes.",
      body?.fieldErrors,
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/estabelecimentos/submitEstablishmentForm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/estabelecimentos/submitEstablishmentForm.ts src/lib/estabelecimentos/submitEstablishmentForm.test.ts
git commit -m "feat(estabelecimentos): add client-side form submission helper"
```

---

## Task 7: Frontend form page

**Files:**
- Create: `src/app/parceiros/cadastro/page.tsx`
- Test: `src/app/parceiros/cadastro/page.test.tsx`
- Modify: `package.json` (new dependencies)

**Interfaces:**
- Consumes: `establishmentFieldsSchema`, `validatePhotos`, `CATEGORY_OPTIONS`, `REGION_OPTIONS`, `PRICE_RANGE_OPTIONS`, `EstablishmentFields` from `@/lib/estabelecimentos/schema` (Task 2); `submitEstablishmentForm`, `EstablishmentSubmissionError` from `@/lib/estabelecimentos/submitEstablishmentForm` (Task 6); `Button` from `@/components/ui/Button`.
- Produces: default-exported `CadastroEstabelecimentoPage` React component, routed at `/parceiros/cadastro` by the App Router (no other task consumes this directly).

- [ ] **Step 1: Install the new dependencies**

Run: `npm install react-hook-form @hookform/resolvers`

- [ ] **Step 2: Write the failing tests**

```tsx
// src/app/parceiros/cadastro/page.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/estabelecimentos/submitEstablishmentForm", () => ({
  submitEstablishmentForm: vi.fn(),
  EstablishmentSubmissionError: class EstablishmentSubmissionError extends Error {
    fieldErrors?: Record<string, string>;
    constructor(message: string, fieldErrors?: Record<string, string>) {
      super(message);
      this.fieldErrors = fieldErrors;
    }
  },
}));

import CadastroEstabelecimentoPage from "./page";
import { submitEstablishmentForm, EstablishmentSubmissionError } from "@/lib/estabelecimentos/submitEstablishmentForm";

function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText(/nome do estabelecimento/i), { target: { value: "Bar do Zé" } });
  fireEvent.change(screen.getByPlaceholderText(/tipo \(ex/i), { target: { value: "Bar" } });
  fireEvent.change(screen.getByPlaceholderText(/breve descrição/i), {
    target: { value: "Bar de esquina com música ao vivo às sextas." },
  });
  fireEvent.change(screen.getByPlaceholderText(/bairro/i), { target: { value: "Campeche" } });
  fireEvent.change(screen.getByPlaceholderText(/endereço completo/i), { target: { value: "Rua das Gaivotas, 123" } });
  fireEvent.change(screen.getByPlaceholderText(/^telefone$/i), { target: { value: "(48) 99999-0000" } });
  fireEvent.change(screen.getByPlaceholderText(/ex: seg a sáb/i), { target: { value: "Ter a Dom, 18h às 0h" } });
  fireEvent.change(screen.getByPlaceholderText(/^seu nome$/i), { target: { value: "José Silva" } });
  fireEvent.change(screen.getByPlaceholderText(/^seu e-mail$/i), { target: { value: "jose@example.com" } });
  fireEvent.change(screen.getByPlaceholderText(/^seu telefone$/i), { target: { value: "(48) 99999-0001" } });
}

describe("CadastroEstabelecimentoPage", () => {
  beforeEach(() => {
    vi.mocked(submitEstablishmentForm).mockReset();
  });

  it("renders the form with its section headings", () => {
    render(<CadastroEstabelecimentoPage />);
    expect(screen.getByText(/sobre o negócio/i)).toBeInTheDocument();
    expect(screen.getByText(/localização e contato/i)).toBeInTheDocument();
    expect(screen.getByText(/seus dados de contato/i)).toBeInTheDocument();
  });

  it("does not submit when required fields are empty", async () => {
    render(<CadastroEstabelecimentoPage />);
    fireEvent.click(screen.getByRole("button", { name: /enviar cadastro/i }));
    await waitFor(() => expect(submitEstablishmentForm).not.toHaveBeenCalled());
  });

  it("submits and shows a confirmation message on success", async () => {
    vi.mocked(submitEstablishmentForm).mockResolvedValue(undefined);
    render(<CadastroEstabelecimentoPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: /enviar cadastro/i }));
    await waitFor(() => expect(screen.getByText(/cadastro recebido/i)).toBeInTheDocument());
  });

  it("shows the server error message when submission fails", async () => {
    vi.mocked(submitEstablishmentForm).mockRejectedValue(
      new EstablishmentSubmissionError("Não foi possível enviar seu cadastro. Tente novamente em instantes."),
    );
    render(<CadastroEstabelecimentoPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: /enviar cadastro/i }));
    await waitFor(() => expect(screen.getByText(/não foi possível enviar/i)).toBeInTheDocument());
    expect(screen.getByPlaceholderText(/nome do estabelecimento/i)).toHaveValue("Bar do Zé");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/app/parceiros/cadastro/page.test.tsx`
Expected: FAIL with a module-not-found error for `./page`.

- [ ] **Step 4: Write the implementation**

```tsx
// src/app/parceiros/cadastro/page.tsx
"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  establishmentFieldsSchema,
  validatePhotos,
  CATEGORY_OPTIONS,
  REGION_OPTIONS,
  PRICE_RANGE_OPTIONS,
  type EstablishmentFields,
} from "@/lib/estabelecimentos/schema";
import {
  submitEstablishmentForm,
  EstablishmentSubmissionError,
} from "@/lib/estabelecimentos/submitEstablishmentForm";
import { Button } from "@/components/ui/Button";

const inputClass =
  "w-full rounded-pill border border-teal-ink/15 bg-white px-4 py-3 text-sm text-teal-ink placeholder:text-teal-ink/40";
const textareaClass =
  "w-full rounded-card border border-teal-ink/15 bg-white px-4 py-3 text-sm text-teal-ink placeholder:text-teal-ink/40";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-coral">{message}</p>;
}

export default function CadastroEstabelecimentoPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EstablishmentFields>({
    resolver: zodResolver(establishmentFieldsSchema),
    defaultValues: {
      name: "", category: CATEGORY_OPTIONS[0], point_type: "", short_description: "",
      region: REGION_OPTIONS[0], neighborhood: "", address: "", price_range: PRICE_RANGE_OPTIONS[0],
      opening_hours: "", phone: "", instagram: "", contact_name: "", contact_email: "", contact_phone: "",
    },
  });

  const honeypotRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const error = validatePhotos(files);
    setPhotoError(error);
    setPhotos(error ? [] : files);
  }

  async function onSubmit(values: EstablishmentFields) {
    const currentPhotoError = validatePhotos(photos);
    if (currentPhotoError) {
      setPhotoError(currentPhotoError);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitEstablishmentForm(values, photos, honeypotRef.current?.value ?? "");
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof EstablishmentSubmissionError || err instanceof Error ? err.message : "Erro inesperado.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-2xl font-extrabold text-teal-ink">Cadastro recebido!</h1>
        <p className="text-sm text-teal-ink/60">
          Nossa equipe vai revisar as informações e entrar em contato em breve.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="font-display text-2xl font-extrabold text-teal-ink">Cadastre seu estabelecimento</h1>
      <p className="mt-2 text-sm text-teal-ink/60">
        Preencha os dados abaixo para aparecer no Floripa.me. Sua listagem entra em análise antes de ficar visível.
      </p>

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

          <textarea
            {...register("short_description")}
            placeholder="Breve descrição do que vocês oferecem"
            rows={3}
            className={textareaClass}
          />
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

          <input {...register("instagram")} placeholder="@seuinstagram (opcional)" className={inputClass} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-teal-ink">Horário de funcionamento</h2>
          <input {...register("opening_hours")} placeholder="Ex: Seg a Sáb, 9h às 18h" className={inputClass} />
          <FieldError message={errors.opening_hours?.message} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-teal-ink">Fotos</h2>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotoChange} />
          {photos.length > 0 && <p className="text-xs text-teal-ink/60">{photos.length} foto(s) selecionada(s)</p>}
          <FieldError message={photoError ?? undefined} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-teal-ink">Seus dados de contato</h2>
          <p className="text-xs text-teal-ink/60">
            Não aparecem publicamente — só usamos para falar com você durante a revisão.
          </p>
          <input {...register("contact_name")} placeholder="Seu nome" className={inputClass} />
          <FieldError message={errors.contact_name?.message} />

          <input {...register("contact_email")} placeholder="Seu e-mail" className={inputClass} />
          <FieldError message={errors.contact_email?.message} />

          <input {...register("contact_phone")} placeholder="Seu telefone" className={inputClass} />
          <FieldError message={errors.contact_phone?.message} />
        </section>

        <input
          type="text"
          ref={honeypotRef}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />

        {submitError && <p className="text-sm text-coral">{submitError}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Enviando..." : "Enviar cadastro"}
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/app/parceiros/cadastro/page.test.tsx`
Expected: PASS. If the "does not submit when required fields are empty" test fails because `zodResolver` lets it through, double check `establishmentFieldsSchema`'s required fields all use `requiredText()` (Task 2) and that `handleSubmit` is wired to `onSubmit` via `form onSubmit={handleSubmit(onSubmit)}`.

- [ ] **Step 6: Run the full suite once more**

Run: `npm test`
Expected: PASS across the whole repo (confirms the new `react-hook-form`/`@hookform/resolvers` dependency didn't destabilize anything else).

- [ ] **Step 7: Commit**

```bash
git add src/app/parceiros/cadastro/page.tsx src/app/parceiros/cadastro/page.test.tsx package.json package-lock.json
git commit -m "feat(estabelecimentos): add public establishment signup page"
```

---

## Task 8: Manual deployment steps (not automated — run once against the real Supabase project)

This task has no automated test; it's the click-by-click checklist for applying Tasks 1–7's backend requirements to the live Supabase project, the same kind of manual step the README already lists for other migrations.

- [ ] **Step 1: Apply the migration**

Open the Supabase dashboard for the project → **SQL Editor** → **New query**. Paste the full contents of `supabase/migrations/0004_add_establishment_signup_fields.sql` → click **Run**. Confirm no error is shown.

(Alternative, if the Supabase CLI is already linked per the README: `npx supabase db push`.)

- [ ] **Step 2: Create the Storage bucket**

In the Supabase dashboard → **Storage** → **New bucket**. Name it exactly `establishment-photos`. Toggle **Public bucket** to **ON** (this only controls who can *view* uploaded files — uploads still only ever happen through the app's server route with the service-role key). Click **Save**.

- [ ] **Step 3: Verify**

In **Table Editor** → `places`, confirm the four new columns (`contact_name`, `contact_email`, `contact_phone`, `submission_source`) appear. In **Storage**, confirm the `establishment-photos` bucket is listed and marked public.

- [ ] **Step 4: Smoke-test the live form**

Deploy the app (or run `npm run dev` against the now-migrated project) and submit a real test entry through `/parceiros/cadastro`, including at least one photo. In **Table Editor** → `places`, confirm a new row appears with `is_verified = false`, `submission_source = 'self_signup'`, and a working photo URL in `photos`. Delete this test row afterward (or flip `is_verified` to `true` if you'd rather keep it as a first real test listing).
