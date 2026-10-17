import { S3Client } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME!;

// Clé d'un fichier à partir de son adresse publique enregistrée en base.
// Accepte toute adresse r2.dev (pas seulement R2_PUBLIC_URL) pour que les
// adresses de l'ancien stockage restent lisibles pendant et après le
// déménagement vers le stockage « sonoo » (2026-10-17).
export function cleR2(url: string): string {
  const prefixe = `${process.env.R2_PUBLIC_URL}/`
  if (url.startsWith(prefixe)) return url.slice(prefixe.length)
  const publique = url.match(/^https:\/\/[^/]+\.r2\.dev\/(.+)$/)
  return publique ? publique[1] : url
}
