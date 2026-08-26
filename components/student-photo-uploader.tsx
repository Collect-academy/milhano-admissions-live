"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle } from "lucide-react";

import { saveStudentPhotoPath } from "@/app/alumnos/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_DIMENSION = 512;
const TARGET_BYTES = 220 * 1024;

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("No se pudo optimizar la imagen.")),
      "image/webp",
      quality,
    );
  });
}

async function optimizeStudentPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Selecciona un archivo de imagen.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("La imagen original supera 12 MB.");

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("El navegador no pudo preparar la imagen.");
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.78;
  let blob = await canvasBlob(canvas, quality);
  while (blob.size > TARGET_BYTES && quality > 0.5) {
    quality -= 0.07;
    blob = await canvasBlob(canvas, quality);
  }
  if (blob.size > 500 * 1024) throw new Error("No fue posible reducir la foto a un tamaño seguro. Prueba otra imagen.");
  return blob;
}

type Props = {
  studentId: string;
  canEdit: boolean;
  currentPath: string;
  initialPreviewUrl?: string | null;
  onUploaded: (path: string) => void;
};

export function StudentPhotoUploader({ studentId, canEdit, currentPath, initialPreviewUrl, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState(initialPreviewUrl ?? null);
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file || !canEdit) return;
    setState("working");
    setMessage("Optimizando foto…");

    let localPreview: string | null = null;
    try {
      const optimized = await optimizeStudentPhoto(file);
      setMessage("Subiendo foto optimizada…");
      const path = `${studentId}/photo-${Date.now()}.webp`;
      const supabase = createSupabaseBrowserClient();
      const upload = await supabase.storage.from("student-photos").upload(path, optimized, {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: false,
      });
      if (upload.error) throw new Error(upload.error.message);

      try {
        await saveStudentPhotoPath({ studentId, newPath: path, oldPath: currentPath || null });
      } catch (error) {
        await supabase.storage.from("student-photos").remove([path]);
        throw error;
      }

      localPreview = URL.createObjectURL(optimized);
      setPreviewUrl((previous) => {
        if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
        return localPreview;
      });
      onUploaded(path);
      setState("done");
      setMessage(`Optimizada a ${Math.max(1, Math.round(optimized.size / 1024))} KB · WebP · máx. ${MAX_DIMENSION}px`);
    } catch (error) {
      if (localPreview) URL.revokeObjectURL(localPreview);
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo subir la foto.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="student-photo-field student-field-full">
      <div className="student-field-label-row">
        <span>Foto reciente <span className={currentPath ? "required-ok" : "required-missing"}>*</span></span>
      </div>
      <div className="student-photo-upload-card">
        <div className="student-photo-preview">
          {previewUrl ? <img alt="Foto reciente del alumno" src={previewUrl} /> : <Camera size={30} />}
        </div>
        <div className="student-photo-upload-copy">
          <strong>{previewUrl ? "Foto del expediente" : "Sin foto cargada"}</strong>
          <span>La imagen se reduce automáticamente antes de subirla para cuidar almacenamiento y velocidad.</span>
          {message ? <small className={state === "error" ? "student-photo-error" : ""}>{message}</small> : null}
          {canEdit ? (
            <>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="student-photo-file-input"
                disabled={state === "working"}
                onChange={(event) => void handleFile(event.target.files?.[0])}
                ref={inputRef}
                type="file"
              />
              <button
                className="secondary-button no-print"
                disabled={state === "working"}
                onClick={() => inputRef.current?.click()}
                type="button"
              >
                {state === "working" ? <LoaderCircle className="spin" size={15} /> : <ImagePlus size={15} />}
                {previewUrl ? "Cambiar foto" : "Subir foto"}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
