import { NextResponse } from "next/server";

// Matches a Google Places (New) photo resource name, e.g.
// "places/ChIJ.../photos/AWU5eF...". Validated strictly since `ref` is
// interpolated directly into the outgoing fetch URL below.
const PHOTO_REF_PATTERN = /^places\/[^/]+\/photos\/[^/]+$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref");

  if (!ref || !PHOTO_REF_PATTERN.test(ref)) {
    return NextResponse.json({ error: "Parâmetro 'ref' inválido ou ausente." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_PLACES_API_KEY não configurada.");
    return NextResponse.json({ error: "Serviço de fotos não configurado." }, { status: 500 });
  }

  const googleUrl = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=800&key=${apiKey}`;
  const response = await fetch(googleUrl);

  if (!response.ok || !response.body) {
    return NextResponse.json({ error: "Foto não encontrada." }, { status: response.status === 404 ? 404 : 502 });
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
