import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { AdminHeader } from "./AdminHeader";

beforeEach(() => {
  push.mockClear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true } as Response));
});

describe("AdminHeader", () => {
  it("logs out and redirects to the login page when Sair is clicked", async () => {
    render(<AdminHeader />);
    fireEvent.click(screen.getByRole("button", { name: /sair/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/login"));
    expect(fetch).toHaveBeenCalledWith("/api/admin/logout", expect.objectContaining({ method: "POST" }));
  });

  it("shows the brand wordmark", () => {
    render(<AdminHeader />);
    expect(screen.getByText("Floripa")).toBeInTheDocument();
  });

  it("shows a visible Voltar button pointing to backHref when given", () => {
    render(<AdminHeader backHref="/admin" />);
    expect(screen.getByRole("link", { name: /voltar/i })).toHaveAttribute("href", "/admin");
  });

  it("hides the Voltar button when no backHref is given", () => {
    render(<AdminHeader />);
    expect(screen.queryByRole("link", { name: /voltar/i })).not.toBeInTheDocument();
  });
});
