"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function HeroCarousel({
  images,
  intervalMs = 5000,
}: {
  images: { src: string; focus?: string }[];
  intervalMs?: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [images.length, intervalMs]);

  return (
    <>
      {images.map((image, index) => (
        <Image
          key={image.src}
          src={image.src}
          alt=""
          fill
          priority={index === 0}
          // object-cover in a fixed-height box can render much wider than the
          // viewport for wide-aspect photos (e.g. a 2.8:1 photo in a tall,
          // narrow box) — a 100vw hint under-serves resolution and the
          // browser upscales it, producing visible blur. 300vw keeps it sharp.
          sizes="300vw"
          style={{ objectPosition: image.focus ?? "center 65%" }}
          className={`object-cover transition-opacity duration-1000 ${
            index === activeIndex ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </>
  );
}
