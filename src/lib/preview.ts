/**
 * Achica una captura del 3D a una vista previa liviana (JPEG de 480 × 360),
 * recortando al centro. Así un diseño guardado pesa unos 25 KB de imagen.
 */
export const PREVIEW_SIZE = { width: 480, height: 360 } as const;

export function shrinkImage(dataUrl: string, width: number = PREVIEW_SIZE.width, height: number = PREVIEW_SIZE.height): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        // llena el cuadro sin deformar: sobra por el lado que más mide
        const scale = Math.max(width / img.width, height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.74));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
