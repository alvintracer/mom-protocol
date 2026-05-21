"use client";

import { useRef, useState } from "react";
import { RiPlayFill, RiVolumeMuteLine, RiVolumeUpLine } from "react-icons/ri";

import { ImageLightbox } from "./ImageLightbox";

/* ── Types ───────────────────────────────────────────── */

export type MediaItem = {
  url: string;
  type: string;
  name?: string;
};

type PostMediaGridProps = {
  items: MediaItem[];
  /** "feed" = constrained height, "detail" = larger */
  variant?: "feed" | "detail";
};

/* ── Main Component ──────────────────────────────────── */

export function PostMediaGrid({ items, variant = "feed" }: PostMediaGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!items || items.length === 0) return null;

  const images = items.filter((i) => i.type.startsWith("image/"));
  const videos = items.filter((i) => i.type.startsWith("video/"));

  // ─── Video mode ───
  if (videos.length > 0) {
    return (
      <div className="mt-3">
        <VideoPlayer src={videos[0].url} variant={variant} />
      </div>
    );
  }

  // ─── Image mode ───
  if (images.length === 0) return null;

  const openLightbox = (idx: number) => setLightboxIndex(idx);

  return (
    <>
      {/* 16:9 aspect container keeps grid from stretching on wide screens */}
      <div className="mt-3 aspect-video max-h-[420px] overflow-hidden rounded-2xl border border-border">
        {images.length === 1 && (
          <SingleImage image={images[0]} onClick={() => openLightbox(0)} />
        )}
        {images.length === 2 && (
          <TwoImages images={images} onClick={openLightbox} />
        )}
        {images.length === 3 && (
          <ThreeImages images={images} onClick={openLightbox} />
        )}
        {images.length >= 4 && (
          <FourImages images={images.slice(0, 4)} onClick={openLightbox} />
        )}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={images.map((i) => ({ url: i.url, alt: i.name }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}

/* ── Layout Components ───────────────────────────────── */

function SingleImage({
  image,
  onClick,
}: {
  image: MediaItem;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="block h-full w-full">
      <img
        src={image.url}
        alt={image.name || ""}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </button>
  );
}

function TwoImages({
  images,
  onClick,
}: {
  images: MediaItem[];
  onClick: (i: number) => void;
}) {
  return (
    <div className="grid h-full grid-cols-2 gap-0.5">
      {images.map((img, idx) => (
        <button key={idx} type="button" onClick={() => onClick(idx)} className="overflow-hidden">
          <img
            src={img.url}
            alt={img.name || ""}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}

function ThreeImages({
  images,
  onClick,
}: {
  images: MediaItem[];
  onClick: (i: number) => void;
}) {
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-0.5">
      {/* Left: large spanning 2 rows */}
      <button type="button" onClick={() => onClick(0)} className="row-span-2 overflow-hidden">
        <img
          src={images[0].url}
          alt={images[0].name || ""}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </button>
      {/* Right: 2 stacked */}
      <button type="button" onClick={() => onClick(1)} className="overflow-hidden">
        <img
          src={images[1].url}
          alt={images[1].name || ""}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </button>
      <button type="button" onClick={() => onClick(2)} className="overflow-hidden">
        <img
          src={images[2].url}
          alt={images[2].name || ""}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </button>
    </div>
  );
}

function FourImages({
  images,
  onClick,
}: {
  images: MediaItem[];
  onClick: (i: number) => void;
}) {
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-0.5">
      {images.map((img, idx) => (
        <button key={idx} type="button" onClick={() => onClick(idx)} className="overflow-hidden">
          <img
            src={img.url}
            alt={img.name || ""}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}

/* ── Video Player ────────────────────────────────────── */

function VideoPlayer({ src, variant }: { src: string; variant: "feed" | "detail" }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  return (
    <div
      className="relative aspect-video max-h-[420px] overflow-hidden rounded-2xl border border-border bg-black"
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        className="h-full w-full object-contain"
        muted={muted}
        playsInline
        loop
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Play overlay */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="flex size-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
            <RiPlayFill className="size-7 text-zinc-900 ml-0.5" />
          </div>
        </div>
      )}

      {/* Mute toggle */}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
      >
        {muted ? (
          <RiVolumeMuteLine className="size-4" />
        ) : (
          <RiVolumeUpLine className="size-4" />
        )}
      </button>
    </div>
  );
}
