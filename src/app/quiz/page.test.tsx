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
    expect(screen.getByText(/como você chega em floripa/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continuar/i })).toBeDisabled();
  });

  it("advances to the next question after answering and clicking Continuar", () => {
    render(<QuizPage />);
    fireEvent.click(screen.getByRole("button", { name: /já estou em floripa/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    expect(screen.getByText(/onde você vai se hospedar/i)).toBeInTheDocument();
  });

  it("submits the answers and navigates to the roteiro page after the last question", async () => {
    render(<QuizPage />);
    // timing
    fireEvent.click(screen.getByRole("button", { name: /já estou em floripa/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // region (optional) — skip
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // days
    fireEvent.click(screen.getByRole("button", { name: /1 dia/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // group
    fireEvent.click(screen.getByRole("button", { name: /solo/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // style (multi)
    fireEvent.click(screen.getByRole("button", { name: /praia, surf/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // transport
    fireEvent.click(screen.getByRole("button", { name: /a pé/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // budget (slider, has default) — just continue
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // special (optional) — final button label changes to "Ver meu roteiro"
    fireEvent.click(screen.getByRole("button", { name: /ver meu roteiro/i }));

    await waitFor(() => expect(submitQuizAnswers).toHaveBeenCalled());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/roteiro/abc123"));
    expect(window.localStorage.getItem("floripa_last_itinerary_slug")).toBe("abc123");
  });
});
