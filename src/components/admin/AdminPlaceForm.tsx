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

// `category`/`region`/`partner_status` are free text in the DB (see
// adminSchema.ts) — the fixed lists below are only suggestions. If the
// place being edited already has a value outside the list (data older
// than the list itself), inject it as a selectable option so the <select>
// shows it correctly instead of silently falling back to the first option
// and blanking the real value on save.
function optionsWithCurrentValue(options: readonly string[], current: string): string[] {
  return current && !options.includes(current) ? [current, ...options] : [...options];
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

  const categoryOptions = optionsWithCurrentValue(
    CATEGORY_OPTIONS,
    props.mode === "edit" ? props.place.category : "",
  );
  const regionOptions = optionsWithCurrentValue(REGION_OPTIONS, props.mode === "edit" ? props.place.region : "");
  const partnerStatusValues = PARTNER_STATUS_OPTIONS.map((option) => option.value) as string[];
  const currentPartnerStatus = props.mode === "edit" ? (props.place.partner_status ?? "") : "";
  const partnerStatusOptions =
    currentPartnerStatus && !partnerStatusValues.includes(currentPartnerStatus)
      ? [{ value: currentPartnerStatus, label: currentPartnerStatus }, ...PARTNER_STATUS_OPTIONS]
      : PARTNER_STATUS_OPTIONS;

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
          {categoryOptions.map((option) => (
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
          {regionOptions.map((option) => (
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
        <h2 className="font-display text-lg font-bold text-teal-ink">Contato do responsável</h2>
        <p className="text-xs text-teal-ink/60">
          Não aparece publicamente — use pra falar com quem enviou o cadastro.
        </p>
        <input {...register("contact_name")} placeholder="Nome de quem cadastrou" className={inputClass} />
        <input {...register("contact_email")} placeholder="E-mail de contato" className={inputClass} />
        <input {...register("contact_phone")} placeholder="Telefone de contato" className={inputClass} />
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
              {partnerStatusOptions.map((option) => (
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
