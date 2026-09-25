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
