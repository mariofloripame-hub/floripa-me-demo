import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import AdminLoginPage from "./page";

describe("AdminLoginPage", () => {
  beforeEach(() => {
    push.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("redirects to /admin on a successful login", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    render(<AdminLoginPage />);
    fireEvent.change(screen.getByPlaceholderText("Senha"), { target: { value: "correct" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
  });

  it("shows an error and does not redirect on a failed login", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    render(<AdminLoginPage />);
    fireEvent.change(screen.getByPlaceholderText("Senha"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => expect(screen.getByText(/senha incorreta/i)).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });
});
