import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PartnerLoginForm } from "./PartnerLoginForm";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("PartnerLoginForm", () => {
  it("sends the email with next and shows the neutral confirmation", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    render(<PartnerLoginForm next="/parceiro/validar" linkError={false} whatsapp="5548999999999" />);
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), { target: { value: "carlos@box32.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Receber link de acesso" }));
    expect(await screen.findByText("Enviamos um link de acesso para seu e-mail.")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: "carlos@box32.com", next: "/parceiro/validar" });
    expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute("href", "https://wa.me/5548999999999");
  });

  it("hides the WhatsApp link when no number is configured", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    render(<PartnerLoginForm next="/parceiro" linkError={false} />);
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), { target: { value: "carlos@box32.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Receber link de acesso" }));
    await screen.findByText("Enviamos um link de acesso para seu e-mail.");
    expect(screen.queryByRole("link", { name: /whatsapp/i })).not.toBeInTheDocument();
  });

  it("explains an invalid email", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 });
    render(<PartnerLoginForm next="/parceiro" linkError={false} />);
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), { target: { value: "x@y" } });
    fireEvent.click(screen.getByRole("button", { name: "Receber link de acesso" }));
    expect(await screen.findByText("Confira o e-mail digitado.")).toBeInTheDocument();
  });

  it("says the portal is unavailable when the server isn't configured", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    render(<PartnerLoginForm next="/parceiro" linkError={false} />);
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), { target: { value: "carlos@box32.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Receber link de acesso" }));
    expect(await screen.findByText("O portal está indisponível no momento. Tente mais tarde ou fale com a equipe Floripa.My.")).toBeInTheDocument();
    expect(screen.queryByText("Enviamos um link de acesso para seu e-mail.")).not.toBeInTheDocument();
  });

  it("shows the unavailable notice when sent back by the middleware", () => {
    render(<PartnerLoginForm next="/parceiro" linkError={false} unavailable />);
    expect(screen.getByText("O portal está indisponível no momento. Tente mais tarde ou fale com a equipe Floripa.My.")).toBeInTheDocument();
  });

  it("tells the partner when the link they used expired", () => {
    render(<PartnerLoginForm next="/parceiro" linkError />);
    expect(screen.getByText("Esse link expirou ou já foi usado. Peça um novo abaixo.")).toBeInTheDocument();
  });
});
