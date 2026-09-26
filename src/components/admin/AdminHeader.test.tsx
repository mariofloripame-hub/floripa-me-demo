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
});
