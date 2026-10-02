import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ValidateCodeForm } from "./ValidateCodeForm";

const fetchMock = vi.fn();
function respond(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function typeAndCheck(code: string) {
  fireEvent.change(screen.getByLabelText("Código do cliente"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Verificar código" }));
}

describe("ValidateCodeForm", () => {
  it("checks, then confirms in a second step", async () => {
    fetchMock.mockReturnValueOnce(respond(200, { result: { status: "valid", offerText: "Sobremesa cortesia" }, message: "Código válido: Sobremesa cortesia" }));
    render(<ValidateCodeForm />);
    typeAndCheck("4k7p");
    expect(await screen.findByText("Sobremesa cortesia")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReturnValueOnce(respond(200, { ok: true, offerText: "Sobremesa cortesia" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrega" }));
    expect(await screen.findByText(/cortesia entregue/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/parceiro/confirmar");
  });

  it("shows the problem message for an invalid code, with no confirm button", async () => {
    fetchMock.mockReturnValueOnce(respond(200, { result: { status: "expired" }, message: "Código expirado. Peça ao cliente para gerar um novo no app." }));
    render(<ValidateCodeForm />);
    typeAndCheck("FMY-4K7P");
    expect(await screen.findByText("Código expirado. Peça ao cliente para gerar um novo no app.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar entrega" })).not.toBeInTheDocument();
  });

  it("shows the conflict message when confirming loses a race", async () => {
    fetchMock.mockReturnValueOnce(respond(200, { result: { status: "valid", offerText: "Sobremesa" }, message: "Código válido: Sobremesa" }));
    render(<ValidateCodeForm />);
    typeAndCheck("FMY-4K7P");
    await screen.findByRole("button", { name: "Confirmar entrega" });
    fetchMock.mockReturnValueOnce(respond(409, { result: { status: "used", redeemedAt: "2026-09-27T16:10:00Z" }, message: "Este código já foi usado em 27/09 às 13h10." }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrega" }));
    expect(await screen.findByText("Este código já foi usado em 27/09 às 13h10.")).toBeInTheDocument();
  });

  it("recovers from a network failure while checking, letting staff try again", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<ValidateCodeForm />);
    typeAndCheck("FMY-4K7P");
    expect(await screen.findByText("Sem conexão ou erro no servidor. Tente de novo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verificar código" })).toBeEnabled();
  });

  it("keeps the confirm button after a failed confirmation so it can be retried", async () => {
    fetchMock.mockReturnValueOnce(respond(200, { result: { status: "valid", offerText: "Sobremesa" }, message: "Código válido: Sobremesa" }));
    render(<ValidateCodeForm />);
    typeAndCheck("FMY-4K7P");
    await screen.findByRole("button", { name: "Confirmar entrega" });
    fetchMock.mockReturnValueOnce(respond(500, "Internal Server Error"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrega" }));
    expect(await screen.findByText("Sem conexão ou erro no servidor. Tente de novo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar entrega" })).toBeInTheDocument();
  });

  it("shows the server's retry message when confirming hit a transient conflict", async () => {
    fetchMock.mockReturnValueOnce(respond(200, { result: { status: "valid", offerText: "Sobremesa" }, message: "Código válido: Sobremesa" }));
    render(<ValidateCodeForm />);
    typeAndCheck("FMY-4K7P");
    await screen.findByRole("button", { name: "Confirmar entrega" });
    fetchMock.mockReturnValueOnce(respond(409, { result: { status: "valid", offerText: "Sobremesa" }, message: "Não foi possível confirmar. Tente de novo." }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrega" }));
    expect(await screen.findByText("Não foi possível confirmar. Tente de novo.")).toBeInTheDocument();
  });

  it("shows FMY- as a fixed prefix, so staff type only the 4 characters", async () => {
    fetchMock.mockReturnValueOnce(respond(200, { result: { status: "expired" }, message: "Código expirado." }));
    render(<ValidateCodeForm />);
    expect(screen.getByText("FMY-")).toBeInTheDocument();
    typeAndCheck("4k7p");
    await screen.findByText("Código expirado.");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ code: "FMY-4K7P" });
  });

  it("drops a typed or pasted FMY- prefix instead of doubling it", () => {
    render(<ValidateCodeForm />);
    const input = screen.getByLabelText("Código do cliente");
    fireEvent.change(input, { target: { value: "fmy-4k7p" } });
    expect(input).toHaveValue("4K7P");
  });

  it("keeps at most 4 characters and only letters or digits", () => {
    render(<ValidateCodeForm />);
    const input = screen.getByLabelText("Código do cliente");
    fireEvent.change(input, { target: { value: "4k-7p9z" } });
    expect(input).toHaveValue("4K7P");
  });

  it("only enables Verificar once all 4 characters are typed", () => {
    render(<ValidateCodeForm />);
    fireEvent.change(screen.getByLabelText("Código do cliente"), { target: { value: "4k7" } });
    expect(screen.getByRole("button", { name: "Verificar código" })).toBeDisabled();
  });

  it("sends a logged-out partner to the login", async () => {
    fetchMock.mockReturnValueOnce(respond(401, { error: "Não autenticado" }));
    render(<ValidateCodeForm />);
    typeAndCheck("FMY-4K7P");
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/parceiro/entrar?next=%2Fparceiro%2Fvalidar"));
  });
});
