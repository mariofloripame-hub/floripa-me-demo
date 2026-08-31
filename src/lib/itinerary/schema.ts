import { z } from "zod";

export const ItineraryActivitySchema = z.object({
  place_id: z.string(),
  time: z.string(),
});

export const ItineraryDaySchema = z.object({
  day_number: z.number().int().positive(),
  theme: z.string(),
  activities: z.array(ItineraryActivitySchema).min(1),
});

export const ItineraryGenerationSchema = z.object({
  welcome_message: z.string(),
  days: z.array(ItineraryDaySchema).min(1),
});

export type ItineraryGeneration = z.infer<typeof ItineraryGenerationSchema>;
