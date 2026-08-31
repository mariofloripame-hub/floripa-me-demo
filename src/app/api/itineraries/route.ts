import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { createItinerary, NoCandidatesError } from "@/lib/itinerary/createItinerary";
import type { QuizAnswers } from "@/lib/quiz/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const answers = body?.answers as QuizAnswers | undefined;
  if (!answers) {
    return NextResponse.json({ error: "answers é obrigatório" }, { status: 400 });
  }

  try {
    const row = await createItinerary(answers, { supabase: getSupabaseAdminClient() });
    return NextResponse.json({ slug: row.slug }, { status: 201 });
  } catch (error) {
    if (error instanceof NoCandidatesError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Itinerary generation failed", error);
    return NextResponse.json({ error: "Não foi possível gerar o roteiro agora. Tente novamente." }, { status: 502 });
  }
}
