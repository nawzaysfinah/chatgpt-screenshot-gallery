"use client";

import NextImage from "next/image";
import { useEffect, useMemo, useState } from "react";

import type { PromptCrop } from "@/lib/content/types";

type ThumbnailCanvasProps = {
  src: string;
  crop: PromptCrop;
  alt: string;
};

function cacheKeyFor(src: string): string {
  return `csg:thumb:v2:${src}`;
}

function resolvePreviewBounds(naturalWidth: number, naturalHeight: number) {
  if (naturalHeight <= naturalWidth) {
    const size = naturalHeight;
    return {
      sx: Math.floor((naturalWidth - size) / 2),
      sy: 0,
      sw: size,
      sh: size,
    };
  }

  const size = naturalWidth;
  const topOffset = Math.min(Math.floor(naturalHeight * 0.1), Math.max(0, naturalHeight - size));
  return {
    sx: 0,
    sy: topOffset,
    sw: size,
    sh: size,
  };
}

export default function ThumbnailCanvas({ src, crop, alt }: ThumbnailCanvasProps) {
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const cacheKey = useMemo(() => cacheKeyFor(src), [src]);

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
    image.crossOrigin = "anonymous";
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

      const { sx, sy, sw, sh } = resolvePreviewBounds(naturalWidth, naturalHeight);

      const outputWidth = 720;
      const outputHeight = outputWidth;
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        setReady(true);
        return;
      }

      context.drawImage(image, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
      let dataUrl: string;
      try {
        dataUrl = canvas.toDataURL("image/jpeg", 0.86);
      } catch {
        setReady(true);
        return;
      }

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
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      {!ready ? <div className="aspect-square animate-pulse bg-slate-800" aria-hidden="true" /> : null}
      <NextImage
        src={thumbDataUrl ?? src}
        alt={alt}
        width={720}
        height={720}
        unoptimized
        className={`aspect-square w-full object-cover object-top transition ${ready ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
