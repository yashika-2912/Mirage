import EXIF from 'exif-js';

export async function getAllExifTags(file: File): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    EXIF.getData(file as any, function(this: any) {
      const allTags = EXIF.getAllTags(this);
      resolve(allTags || {});
    });
  });
}

export async function getGpsMetadata(file: File): Promise<{ lat: number, lng: number } | null> {
  return new Promise((resolve) => {
    EXIF.getData(file as any, function(this: any) {
      const lat = EXIF.getTag(this, "GPSLatitude");
      const lng = EXIF.getTag(this, "GPSLongitude");
      const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
      const lngRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";

      if (!lat || !lng) {
        resolve(null);
        return;
      }

      const convertToDegree = (coord: any) => {
        return coord[0] + coord[1] / 60 + coord[2] / 3600;
      };

      let latitude = convertToDegree(lat);
      let longitude = convertToDegree(lng);

      if (latRef === "S") latitude = -latitude;
      if (lngRef === "W") longitude = -longitude;

      resolve({ lat: latitude, lng: longitude });
    });
  });
}

export function sampleBackgroundColor(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): string {
  const width = x2 - x1;
  const height = y2 - y1;
  
  // Sample a few pixels around the box
  const samples = [
    ctx.getImageData(Math.max(0, x1 - 2), Math.max(0, y1 - 2), 1, 1).data,
    ctx.getImageData(Math.min(ctx.canvas.width - 1, x2 + 2), Math.max(0, y1 - 2), 1, 1).data,
    ctx.getImageData(Math.max(0, x1 - 2), Math.min(ctx.canvas.height - 1, y2 + 2), 1, 1).data,
    ctx.getImageData(Math.min(ctx.canvas.width - 1, x2 + 2), Math.min(ctx.canvas.height - 1, y2 + 2), 1, 1).data,
  ];

  const avg = samples.reduce((acc, curr) => {
    acc[0] += curr[0];
    acc[1] += curr[1];
    acc[2] += curr[2];
    return acc;
  }, [0, 0, 0]);

  const r = Math.round(avg[0] / samples.length);
  const g = Math.round(avg[1] / samples.length);
  const b = Math.round(avg[2] / samples.length);

  return `rgb(${r}, ${g}, ${b})`;
}

export function getContrastingColor(rgb: string): string {
  const match = rgb.match(/\d+/g);
  if (!match) return 'black';
  const [r, g, b] = match.map(Number);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 128 ? 'black' : 'white';
}

export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
