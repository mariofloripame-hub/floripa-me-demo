export interface CourtesyCodeRow {
  id: string;
  code: string;
  place_id: string;
  itinerary_id: string | null;
  device_id: string;
  offer_text: string;
  created_at: string;
  expires_at: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
}

export type NewCourtesyCode = Pick<
  CourtesyCodeRow,
  "code" | "place_id" | "itinerary_id" | "device_id" | "offer_text" | "expires_at"
>;
