import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/quiz/submit", () => ({ submitQuizAnswers: vi.fn().mockResolvedValue({ slug: "abc123" }) }));

import QuizPage from "./page";
import { submitQuizAnswers } from "@/lib/quiz/submit";

describe("QuizPage", () => {
  it("shows the first question, and Continuar is disabled until answered", () => {
    render(<QuizPage />);
    expect(screen.getByText(/qual o motivo da sua viagem/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continuar/i })).toBeDisabled();
  });

  it("auto-advances to the next question after selecting a single-choice answer, without needing Continuar", async () => {
    render(<QuizPage />);
    fireEvent.click(screen.getByRole("button", { name: /estudo ou congresso/i }));
    await waitFor(() => expect(screen.getByText(/quando você vem para florianópolis/i)).toBeInTheDocument());
  });

  it("goes back to the previous question via the top-left back button", async () => {
    render(<QuizPage />);
    fireEvent.click(screen.getByRole("button", { name: /estudo ou congresso/i }));
    await waitFor(() => expect(screen.getByText(/quando você vem para florianópolis/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /voltar/i }));
    expect(screen.getByText(/qual o motivo da sua viagem/i)).toBeInTheDocument();
  });

  it("submits the answers and navigates to the roteiro page after the last question", async () => {
    render(<QuizPage />);
    // purpose (single) — auto-advances
    fireEvent.click(screen.getByRole("button", { name: /estudo ou congresso/i }));
    await waitFor(() => expect(screen.getByText(/quando você vem para florianópolis/i)).toBeInTheDocument());

    // when (single) — auto-advances
    fireEvent.click(screen.getByRole("button", { name: /já estou em floripa/i }));
    await waitFor(() => expect(screen.getByText(/onde você vai se hospedar/i)).toBeInTheDocument());

    // region (optional, single) — skip without answering
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    await waitFor(() => expect(screen.getByText(/quantos dias/i)).toBeInTheDocument());

    // days (single) — auto-advances
    fireEvent.click(screen.getByRole("button", { name: /1 dia/i }));
    await waitFor(() => expect(screen.getByText(/como você está viajando/i)).toBeInTheDocument());

    // group (single) — auto-advances
    fireEvent.click(screen.getByRole("button", { name: /solo/i }));
    await waitFor(() => expect(screen.getByText(/qual é o seu estilo/i)).toBeInTheDocument());

    // style (multi) — needs an explicit Continuar
    fireEvent.click(screen.getByRole("button", { name: /praia, surf/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    await waitFor(() => expect(screen.getByText(/como você vai se locomover/i)).toBeInTheDocument());

    // transport (single) — auto-advances
    fireEvent.click(screen.getByRole("button", { name: /a pé/i }));
    await waitFor(() => expect(screen.getByText(/qual o seu orçamento/i)).toBeInTheDocument());

    // budget (single, no longer a slider) — auto-advances
    fireEvent.click(screen.getByRole("button", { name: /econômico/i }));
    await waitFor(() => expect(screen.getByText(/alguma necessidade especial/i)).toBeInTheDocument());

    // special (single, optional, last question) — selecting auto-submits
    fireEvent.click(screen.getByRole("button", { name: /nenhuma/i }));

    await waitFor(() => expect(screen.getByText("Montando seu roteiro...")).toBeInTheDocument());
    expect(screen.queryByText(/alguma necessidade especial/i)).not.toBeInTheDocument();

    await waitFor(() =>
      expect(submitQuizAnswers).toHaveBeenCalledWith({
        purpose: "estudo_congresso",
        when: "chegou",
        days: "1",
        group: "solo",
        style: ["praia"],
        transport: "pe",
        budget: "economico",
        special: "nenhuma",
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/roteiro/abc123"));
    expect(window.localStorage.getItem("floripa_last_itinerary_slug")).toBe("abc123");
  });
});
