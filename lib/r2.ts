import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

// Rang 9f, Lot 1 : espace SANS adresse publique (MP3 tagué, MP3 propre, WAV,
// stems, factures, contrats, avoirs). Un fichier privé est enregistré en base
// sous la forme « prive:<clé> » ; il ne s'ouvre QUE par un lien signé court.
export const R2_BUCKET_PRIVE = process.env.R2_BUCKET_PRIVE_NAME || null;
export const PREFIXE_PRIVE = "prive:";

export function estPrive(url: string | null | undefined): boolean {
  return !!url && url.startsWith(PREFIXE_PRIVE);
}

// Clé d'un fichier à partir de son adresse publique enregistrée en base.
// Accepte toute adresse r2.dev (pas seulement R2_PUBLIC_URL) pour que les
// adresses de l'ancien stockage restent lisibles pendant et après le
// déménagement vers le stockage « sonoo » (2026-10-17).
export function cleR2(url: string): string {
  if (url.startsWith(PREFIXE_PRIVE)) return url.slice(PREFIXE_PRIVE.length)
  const prefixe = `${process.env.R2_PUBLIC_URL}/`
  if (url.startsWith(prefixe)) return url.slice(prefixe.length)
  const publique = url.match(/^https:\/\/[^/]+\.r2\.dev\/(.+)$/)
  return publique ? publique[1] : url
}

// Espace + clé d'une valeur enregistrée en base (privée ou ancienne adresse publique).
export function emplacementR2(url: string): { bucket: string; key: string } {
  if (url.startsWith(PREFIXE_PRIVE)) {
    if (!R2_BUCKET_PRIVE) throw new Error("R2_BUCKET_PRIVE_NAME manquant");
    return { bucket: R2_BUCKET_PRIVE, key: url.slice(PREFIXE_PRIVE.length) };
  }
  return { bucket: R2_BUCKET, key: cleR2(url) };
}

// Où ranger un nouveau fichier privé : l'espace privé s'il est configuré,
// sinon (avant le réglage Vercel) l'espace public comme avant.
export function destinationPrivee(key: string): { bucket: string; valeurEnBase: string } {
  if (R2_BUCKET_PRIVE) return { bucket: R2_BUCKET_PRIVE, valeurEnBase: `${PREFIXE_PRIVE}${key}` };
  return { bucket: R2_BUCKET, valeurEnBase: `${process.env.R2_PUBLIC_URL}/${key}` };
}

export async function deposerFichierPrive(key: string, corps: Buffer, contentType: string): Promise<string> {
  const { bucket, valeurEnBase } = destinationPrivee(key);
  await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: corps, ContentType: contentType }));
  return valeurEnBase;
}

// Lien temporaire vers un fichier (privé ou ancien public). `nomFichier` =
// téléchargement forcé sous ce nom ; sinon ouverture dans le navigateur (lecteur, PDF).
export async function lienSigneR2(
  url: string,
  options: { secondes: number; nomFichier?: string; contentType?: string }
): Promise<string> {
  const { bucket, key } = emplacementR2(url);
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(options.nomFichier
        ? { ResponseContentDisposition: `attachment; filename="${options.nomFichier.replace(/["\\\r\n]/g, "")}"` }
        : {}),
      ...(options.contentType ? { ResponseContentType: options.contentType } : {}),
    }),
    { expiresIn: options.secondes }
  );
}

export async function lireFichierR2(url: string): Promise<Buffer> {
  const { bucket, key } = emplacementR2(url);
  const res = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const octets = await res.Body?.transformToByteArray();
  if (!octets) throw new Error("Fichier introuvable dans le stockage");
  return Buffer.from(octets);
}

// Un fichier de beat n'est servi QUE s'il est rangé sous ce beat
// (beats/{vendeur}/{beat}/…) : la colonne est modifiable par le vendeur en
// base, il ne doit jamais pouvoir y mettre la clé du fichier d'un autre.
export function fichierAppartientAuBeat(url: string, beat: { id: string; beatmaker_id: string }): boolean {
  if (!estPrive(url)) return true;
  return cleR2(url).startsWith(`beats/${beat.beatmaker_id}/${beat.id}/`);
}
