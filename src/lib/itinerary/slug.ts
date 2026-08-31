const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateSlug(randomFn: () => number = Math.random): string {
  let slug = "";
  for (let i = 0; i < 8; i++) {
    slug += ALPHABET[Math.floor(randomFn() * ALPHABET.length)];
  }
  return slug;
}
