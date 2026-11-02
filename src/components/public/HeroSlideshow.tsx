"use client";

import { useEffect, useState } from "react";

export const PUBLIC_HERO_SLIDES = [
  "/visuals/public-hero.png",
  "/marketplace/shops-hero.png",
  "/assets/auth/hero-desktop.jpg",
  "/assets/auth/bag.jpg",
];

export function HeroSlideshow({
  images = PUBLIC_HERO_SLIDES,
  interval = 4500,
  className = "",
  overlayClass = "",
  showDots = true,
}: {
  images?: string[];
  interval?: number;
  className?: string;
  overlayClass?: string;
  showDots?: boolean;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % images.length);
    }, interval);
    return () => window.clearInterval(timer);
  }, [images.length, interval]);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {images.map((src, slide) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${slide === index ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      {overlayClass ? <div className={`absolute inset-0 ${overlayClass}`} /> : null}
      {showDots && images.length > 1 ? (
        <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
          {images.map((src, slide) => (
            <button
              key={src}
              type="button"
              aria-label={`Show image ${slide + 1}`}
              onClick={() => setIndex(slide)}
              className={`h-1.5 rounded-full transition-all ${slide === index ? "w-5 bg-[#FFB000]" : "w-1.5 bg-white/70"}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
