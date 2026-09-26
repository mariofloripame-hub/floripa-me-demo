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

  // Zod's `.partial()` still applies each field's own `.default(...)` once
  // parsed, so an omitted key like `instagram` would otherwise resolve to
  // "" and get forwarded to updatePlace even though the caller never sent
  // it. Only forward keys the caller actually included, using their
  // validated/parsed values.
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (key in parsed.data) {
      patch[key] = parsed.data[key as keyof typeof parsed.data];
    }
  }

  try {
    const updated = await updatePlace(getSupabaseAdminClient(), id, patch);
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
