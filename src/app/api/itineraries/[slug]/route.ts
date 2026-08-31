import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getItineraryBySlug } from "@/lib/supabase/queries";

interface RouteContext {
  // Next.js 15 passes params as a Promise at runtime; the route test (fixed by
  // the task brief) calls GET with a plain object, so this accepts both.
  params: Promise<{ slug: string }> | { slug: string };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const client = getSupabaseAdminClient();
  const row = await getItineraryBySlug(client, slug);
  if (!row) {
    return NextResponse.json({ error: "Roteiro não encontrado" }, { status: 404 });
  }
  return NextResponse.json(row);
}
