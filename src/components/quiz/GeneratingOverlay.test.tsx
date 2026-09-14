import { act, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GeneratingOverlay, GENERATING_STEPS } from "./GeneratingOverlay";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GeneratingOverlay", () => {
  it("shows every step label", () => {
    render(<GeneratingOverlay />);
    for (const step of GENERATING_STEPS) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
  });

  it("starts with only the first step marked as done", () => {
    render(<GeneratingOverlay />);
    expect(screen.queryAllByText("✓")).toHaveLength(0);
  });

  it("marks one more step done each time the interval elapses", () => {
    render(<GeneratingOverlay />);

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.getAllByText("✓")).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.getAllByText("✓")).toHaveLength(2);
  });

  it("never marks more steps done than exist, even after a long wait", () => {
    render(<GeneratingOverlay />);

    act(() => {
      vi.advanceTimersByTime(1100 * 50);
    });
    expect(screen.getAllByText("✓")).toHaveLength(GENERATING_STEPS.length - 1);
  });
});
