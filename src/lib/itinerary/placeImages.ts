const PLACE_IMAGES: Record<string, string> = {
  "Praia Mole": "/images/praia-mole.jpg",
  "Tia Jú": "/images/tia-ju.jpg",
  Zilá: "/images/rest-zila.jpg",
  "Restaurante do Ceará": "/images/restaurante-ceara.jpg",
  "Praia do Campeche": "/images/praia-campeche.jpg",
  "Ilha do Campeche": "/images/ilha-campeche.jpg",
  "Praia do Matadeiro": "/images/praia-matadeiro.jpg",
  "Jardim Botânico": "/images/jardim-botanico.jpg",
  "Passeio Barco Costa Lagoa": "/images/costa-lagoa.jpg",
  "Aula de Surf": "/images/aula-surf.png",
};

const FALLBACK_IMAGES = [...new Set(Object.values(PLACE_IMAGES))].concat([
  "/images/restaurante-01.jpg",
  "/images/restaurante-02.jpg",
  "/images/restaurante-03.jpg",
  "/images/restaurante-04.jpg",
]);

function fallbackImage(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_IMAGES[hash % FALLBACK_IMAGES.length];
}

export function getPlaceImage(name: string, photo?: string): string {
  // `photo`, when present, is a bare Google Places photo reference (e.g.
  // "places/ChIJ.../photos/abc") — route it through our own server so the
  // Google API key never reaches the visitor's browser.
  if (photo) return `/api/place-photo?ref=${encodeURIComponent(photo)}`;
  return PLACE_IMAGES[name] || fallbackImage(name);
}
