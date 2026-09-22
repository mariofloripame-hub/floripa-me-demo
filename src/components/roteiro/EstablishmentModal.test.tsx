import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EstablishmentModal, nearbyPlaceToDetail, type EstablishmentDetail } from "./EstablishmentModal";
import type { NearbyPlace } from "@/lib/itinerary/nearbyPlaces";

function detail(overrides: Partial<EstablishmentDetail>): EstablishmentDetail {
  return {
    id: "p1",
    name: "Ilha do Campeche",
    category: "Praia",
    price_range: "R$$$",
    address: "Saída da Praia do Campeche",
    short_description: "Um dos principais atrativos de Floripa; acesso depende de operação e mar.",
    photos: [],
    rating: null,
    google_place_id: null,
    partner_offer: null,
    lat: null,
    lng: null,
    ...overrides,
  };
}

describe("EstablishmentModal", () => {
  it("renders nothing when there is no detail", () => {
    const { container } = render(<EstablishmentModal detail={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the name, full description, category, price, and address", () => {
    render(<EstablishmentModal detail={detail({})} onClose={() => {}} />);
    expect(screen.getByText("Ilha do Campeche")).toBeInTheDocument();
    expect(screen.getByText(/um dos principais atrativos de floripa/i)).toBeInTheDocument();
    expect(screen.getByText("Praia")).toBeInTheDocument();
    expect(screen.getByText(/R\$\$\$/)).toBeInTheDocument();
    expect(screen.getByText(/saída da praia do campeche/i)).toBeInTheDocument();
  });

  it("shows the Google rating when available, and hides it otherwise", () => {
    const { rerender } = render(<EstablishmentModal detail={detail({ rating: 4.7 })} onClose={() => {}} />);
    expect(screen.getByText(/4\.7/)).toBeInTheDocument();

    rerender(<EstablishmentModal detail={detail({ rating: null })} onClose={() => {}} />);
    expect(screen.queryByText(/⭐ \d/)).not.toBeInTheDocument();
  });

  it("renders one image per photo reference, routed through the photo proxy", () => {
    render(
      <EstablishmentModal
        detail={detail({ photos: ["places/abc/photos/1", "places/abc/photos/2"] })}
        onClose={() => {}}
      />,
    );
    const images = screen.getAllByRole("img", { name: /ilha do campeche/i });
    expect(images).toHaveLength(2);
    images.forEach((img) => expect(img).toHaveAttribute("src", expect.stringContaining("place-photo")));
  });

  it("shows the exclusive promo badge and its description when the partner has an offer", () => {
    render(
      <EstablishmentModal detail={detail({ partner_offer: "10% de desconto na conta" })} onClose={() => {}} />,
    );
    expect(screen.getByText(/promoção exclusiva/i)).toBeInTheDocument();
    expect(screen.getByText("10% de desconto na conta")).toBeInTheDocument();
  });

  it("shows no promo section when the establishment has no offer", () => {
    render(<EstablishmentModal detail={detail({ partner_offer: null })} onClose={() => {}} />);
    expect(screen.queryByText(/promoção exclusiva/i)).not.toBeInTheDocument();
  });

  it("always shows a link to Google Maps", () => {
    render(<EstablishmentModal detail={detail({ lat: -27.69, lng: -48.46 })} onClose={() => {}} />);
    expect(screen.getByRole("link", { name: /ver no mapa/i })).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent("-27.69,-48.46")),
    );
  });

  it("shows a link to Google reviews only when a google_place_id is available", () => {
    const { rerender } = render(<EstablishmentModal detail={detail({ google_place_id: null })} onClose={() => {}} />);
    expect(screen.queryByRole("link", { name: /avaliaç/i })).not.toBeInTheDocument();

    rerender(<EstablishmentModal detail={detail({ google_place_id: "ChIJ-abc" })} onClose={() => {}} />);
    expect(screen.getByRole("link", { name: /avaliaç/i })).toHaveAttribute(
      "href",
      "https://search.google.com/local/reviews?placeid=ChIJ-abc",
    );
  });

  it("calls onClose when the close button or the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<EstablishmentModal detail={detail({})} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /fechar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<EstablishmentModal detail={detail({})} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the dialog content", () => {
    const onClose = vi.fn();
    render(<EstablishmentModal detail={detail({})} onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows an Adicionar ao roteiro button only when onAdd is provided", () => {
    const { rerender } = render(<EstablishmentModal detail={detail({})} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: /adicionar ao roteiro/i })).not.toBeInTheDocument();

    rerender(<EstablishmentModal detail={detail({})} onClose={() => {}} onAdd={() => {}} />);
    expect(screen.getByRole("button", { name: /adicionar ao roteiro/i })).toBeInTheDocument();
  });

  it("calls onAdd when the button is clicked", () => {
    const onAdd = vi.fn();
    render(<EstablishmentModal detail={detail({})} onClose={() => {}} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar ao roteiro/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe("nearbyPlaceToDetail", () => {
  it("maps a NearbyPlace into an EstablishmentDetail", () => {
    const place: NearbyPlace = {
      id: "n1",
      name: "Restaurante X",
      category: "Gastronomia",
      price_range: "R$$",
      is_partner: false,
      address: "Rua X",
      short_description: "Bom",
      photos: ["places/x/photos/1"],
      rating: 4.2,
      google_place_id: "ChIJ-x",
      partner_offer: null,
      lat: -27.6,
      lng: -48.5,
    };
    expect(nearbyPlaceToDetail(place)).toEqual({
      id: "n1",
      name: "Restaurante X",
      category: "Gastronomia",
      price_range: "R$$",
      address: "Rua X",
      short_description: "Bom",
      photos: ["places/x/photos/1"],
      rating: 4.2,
      google_place_id: "ChIJ-x",
      partner_offer: null,
      lat: -27.6,
      lng: -48.5,
    });
  });
});
