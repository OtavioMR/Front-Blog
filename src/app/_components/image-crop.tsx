"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./image-crop.module.css";

export type Crop = { x: number; y: number; zoom: number; original: boolean };
export const defaultCrop: Crop = { x: 50, y: 50, zoom: 1, original: false };

function bounds(width: number, height: number, ratio: number, crop: Crop) {
  const baseWidth = Math.min(width, height * ratio);
  const w = baseWidth / crop.zoom, h = w / ratio;
  return { x: (width - w) * crop.x / 100, y: (height - h) * crop.y / 100, w, h };
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally { URL.revokeObjectURL(url); }
}

export async function cropImage(file: File, ratio: number, crop: Crop): Promise<File> {
  if (crop.original) return file;
  const image = await loadImage(file);
  const area = bounds(image.naturalWidth, image.naturalHeight, ratio, crop);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(Math.min(area.w, ratio === 1 ? 1024 : 1920)));
  canvas.height = Math.max(1, Math.round(canvas.width / ratio));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem.");
  context.drawImage(image, area.x, area.y, area.w, area.h, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.88));
  if (!blob) throw new Error("Não foi possível preparar a imagem.");
  return new File([blob], "imagem-recortada.webp", { type: blob.type });
}

export default function ImageCrop({ file, ratio, value, onChange, allowOriginal = false }: { file: File; ratio: number; value: Crop; onChange: (crop: Crop) => void; allowOriginal?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    loadImage(file).then(image => {
      if (!active || !canvas.current) return;
      const target = canvas.current, context = target.getContext("2d");
      if (!context) throw new Error();
      context.clearRect(0, 0, target.width, target.height);
      if (value.original) {
        const scale = Math.min(target.width / image.naturalWidth, target.height / image.naturalHeight);
        const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
        context.drawImage(image, (target.width - width) / 2, (target.height - height) / 2, width, height);
      } else {
        const area = bounds(image.naturalWidth, image.naturalHeight, ratio, value);
        context.drawImage(image, area.x, area.y, area.w, area.h, 0, 0, target.width, target.height);
      }
      setError(false);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [file, ratio, value]);
  const change = (key: "x" | "y" | "zoom", next: number) => onChange({ ...value, [key]: next });
  return <div className={styles.crop}>
    {allowOriginal && <label><input type="checkbox" checked={value.original} onChange={event => onChange({ ...value, original: event.target.checked })} /> Usar imagem inteira, sem recorte</label>}
    <p>Prévia {value.original ? "da imagem inteira" : `do recorte ${ratio === 1 ? "da foto de perfil" : "da capa"}`}</p>
    <canvas ref={canvas} width={640} height={Math.round(640 / ratio)} className={styles.preview} aria-label="Prévia da imagem selecionada" />
    {!value.original && <>
      <label>Posição horizontal <input type="range" min="0" max="100" value={value.x} onChange={event => change("x", Number(event.target.value))} /></label>
      <label>Posição vertical <input type="range" min="0" max="100" value={value.y} onChange={event => change("y", Number(event.target.value))} /></label>
      <label>Ampliação <input type="range" min="1" max="3" step="0.05" value={value.zoom} onChange={event => change("zoom", Number(event.target.value))} /></label>
    </>}
    {error && <p role="alert">Não foi possível abrir esta imagem.</p>}
  </div>;
}
