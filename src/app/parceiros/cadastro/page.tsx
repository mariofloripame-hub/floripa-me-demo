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
