import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/estabelecimentos/submitEstablishmentForm", () => ({
  submitEstablishmentForm: vi.fn(),
  EstablishmentSubmissionError: class EstablishmentSubmissionError extends Error {
    fieldErrors?: Record<string, string>;
    constructor(message: string, fieldErrors?: Record<string, string>) {
      super(message);
      this.fieldErrors = fieldErrors;
    }
  },
}));

import CadastroEstabelecimentoPage from "./page";
import { submitEstablishmentForm, EstablishmentSubmissionError } from "@/lib/estabelecimentos/submitEstablishmentForm";

function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText(/nome do estabelecimento/i), { target: { value: "Bar do Zé" } });
  fireEvent.change(screen.getByPlaceholderText(/tipo \(ex/i), { target: { value: "Bar" } });
  fireEvent.change(screen.getByPlaceholderText(/breve descrição/i), {
    target: { value: "Bar de esquina com música ao vivo às sextas." },
  });
  fireEvent.change(screen.getByPlaceholderText(/bairro/i), { target: { value: "Campeche" } });
  fireEvent.change(screen.getByPlaceholderText(/endereço completo/i), { target: { value: "Rua das Gaivotas, 123" } });
  fireEvent.change(screen.getByPlaceholderText(/^telefone$/i), { target: { value: "(48) 99999-0000" } });
  fireEvent.change(screen.getByPlaceholderText(/ex: seg a sáb/i), { target: { value: "Ter a Dom, 18h às 0h" } });
  fireEvent.change(screen.getByPlaceholderText(/^seu nome$/i), { target: { value: "José Silva" } });
  fireEvent.change(screen.getByPlaceholderText(/^seu e-mail$/i), { target: { value: "jose@example.com" } });
  fireEvent.change(screen.getByPlaceholderText(/^seu telefone$/i), { target: { value: "(48) 99999-0001" } });
}

describe("CadastroEstabelecimentoPage", () => {
  beforeEach(() => {
    vi.mocked(submitEstablishmentForm).mockReset();
  });

  it("renders the form with its section headings", () => {
    render(<CadastroEstabelecimentoPage />);
    expect(screen.getByText(/sobre o negócio/i)).toBeInTheDocument();
    expect(screen.getByText(/localização e contato/i)).toBeInTheDocument();
    expect(screen.getByText(/seus dados de contato/i)).toBeInTheDocument();
  });

  it("does not submit when required fields are empty", async () => {
    render(<CadastroEstabelecimentoPage />);
    fireEvent.click(screen.getByRole("button", { name: /enviar cadastro/i }));
    await waitFor(() => expect(submitEstablishmentForm).not.toHaveBeenCalled());
  });

  it("submits and shows a confirmation message on success", async () => {
    vi.mocked(submitEstablishmentForm).mockResolvedValue(undefined);
    render(<CadastroEstabelecimentoPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: /enviar cadastro/i }));
    await waitFor(() => expect(screen.getByText(/cadastro recebido/i)).toBeInTheDocument());
  });

  it("shows the server error message when submission fails", async () => {
    vi.mocked(submitEstablishmentForm).mockRejectedValue(
      new EstablishmentSubmissionError("Não foi possível enviar seu cadastro. Tente novamente em instantes."),
    );
    render(<CadastroEstabelecimentoPage />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: /enviar cadastro/i }));
    await waitFor(() => expect(screen.getByText(/não foi possível enviar/i)).toBeInTheDocument());
    expect(screen.getByPlaceholderText(/nome do estabelecimento/i)).toHaveValue("Bar do Zé");
  });
});
