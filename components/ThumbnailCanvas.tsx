"use client";

import NextImage from "next/image";
import { useEffect, useMemo, useState } from "react";

import type { PromptCrop } from "@/lib/content/types";

type ThumbnailCanvasProps = {
  src: string;
  crop: PromptCrop;
  alt: string;
};

function cacheKeyFor(src: string, crop: PromptCrop): string {
  return `csg:thumb:${src}:${JSON.stringify(crop)}`;
}

export default function ThumbnailCanvas({ src, crop, alt }: ThumbnailCanvasProps) {
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const cacheKey = useMemo(() => cacheKeyFor(src, crop), [src, crop]);

  useEffect(() => {
    let active = true;
    setReady(false);

    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) {
        setThumbDataUrl(cached);
        setReady(true);
        return;
      }
    } catch {
      // Ignore localStorage failures.
    }

    const image = new Image();
    image.decoding = "async";
    image.src = src;

    image.onload = () => {
      if (!active) {
        return;
      }

      const naturalWidth = image.naturalWidth;
      const naturalHeight = image.naturalHeight;
      if (!naturalWidth || !naturalHeight) {
        setReady(true);
        return;
      }

      const sx = Math.floor(naturalWidth * crop.x);
      const sy = Math.floor(naturalHeight * crop.y);
      const sw = Math.max(1, Math.floor(naturalWidth * crop.w));
      const sh = Math.max(1, Math.floor(naturalHeight * crop.h));

      const outputWidth = 720;
      const outputHeight = Math.max(240, Math.round(outputWidth * (sh / sw)));
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        setReady(true);
        return;
      }

      context.drawImage(image, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.86);

      try {
        window.localStorage.setItem(cacheKey, dataUrl);
      } catch {
        // Ignore quota errors.
      }

      setThumbDataUrl(dataUrl);
      setReady(true);
    };

    image.onerror = () => {
      if (active) {
        setReady(true);
      }
    };

    return () => {
      active = false;
    };
  }, [cacheKey, crop, src]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      {!ready ? <div className="h-44 animate-pulse bg-slate-200" aria-hidden="true" /> : null}
      <NextImage
        src={thumbDataUrl ?? src}
        alt={alt}
        width={720}
        height={240}
        unoptimized
        className={`h-44 w-full object-cover transition ${ready ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
