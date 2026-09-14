import { act, render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HeroCarousel } from "./HeroCarousel";

const images = [{ src: "/images/a.png" }, { src: "/images/b.png" }, { src: "/images/c.png" }];

describe("HeroCarousel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders all images with only the first one visible initially", () => {
    render(<HeroCarousel images={images} intervalMs={5000} />);
    const rendered = screen.getAllByRole("presentation", { hidden: true });
    expect(rendered).toHaveLength(3);
    expect(rendered[0]).toHaveClass("opacity-100");
    expect(rendered[1]).toHaveClass("opacity-0");
    expect(rendered[2]).toHaveClass("opacity-0");
  });

  it("advances to the next image after the interval elapses", () => {
    render(<HeroCarousel images={images} intervalMs={5000} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    const rendered = screen.getAllByRole("presentation", { hidden: true });
    expect(rendered[0]).toHaveClass("opacity-0");
    expect(rendered[1]).toHaveClass("opacity-100");
  });

  it("loops back to the first image after the last one", () => {
    render(<HeroCarousel images={images} intervalMs={5000} />);
    act(() => {
      vi.advanceTimersByTime(5000 * 3);
    });
    const rendered = screen.getAllByRole("presentation", { hidden: true });
    expect(rendered[0]).toHaveClass("opacity-100");
  });

  it("does not set up a timer for a single image", () => {
    render(<HeroCarousel images={[{ src: "/images/a.png" }]} intervalMs={5000} />);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("applies a custom focus point as object-position, falling back to a default", () => {
    render(
      <HeroCarousel
        images={[{ src: "/images/a.png" }, { src: "/images/b.png", focus: "72% 42%" }]}
        intervalMs={5000}
      />,
    );
    const rendered = screen.getAllByRole("presentation", { hidden: true });
    expect(rendered[0]).toHaveStyle({ objectPosition: "center 65%" });
    expect(rendered[1]).toHaveStyle({ objectPosition: "72% 42%" });
  });

  it("requests a much wider image than the viewport, so wide-aspect photos aren't upscaled by object-cover", () => {
    render(<HeroCarousel images={images} intervalMs={5000} />);
    const rendered = screen.getAllByRole("presentation", { hidden: true });
    expect(rendered[0]).toHaveAttribute("sizes", "300vw");
  });
});
