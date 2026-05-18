import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2 } from './r2'

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

const FICHIERS_PAR_MODELE: Record<string, Array<'mp3_propre_url' | 'wav_url' | 'stems_url'>> = {
  mp3:      ['mp3_propre_url'],
  wav:      ['mp3_propre_url', 'wav_url'],
  stems:    ['mp3_propre_url', 'wav_url', 'stems_url'],
  illimite: ['mp3_propre_url', 'wav_url', 'stems_url'],
  exclusive:['mp3_propre_url', 'wav_url', 'stems_url'],
}

const LABEL: Record<string, string> = {
  mp3_propre_url: 'MP3 (sans tag)',
  wav_url: 'WAV',
  stems_url: 'Stems (ZIP)',
}

const EXTENSION: Record<string, string> = {
  mp3_propre_url: 'mp3',
  wav_url: 'wav',
  stems_url: 'zip',
}

export async function genererUrlsSignees(
  beat: { titre?: string; mp3_propre_url?: string | null; wav_url?: string | null; stems_url?: string | null },
  modele: string
): Promise<{ label: string; url: string }[]> {
  const champs = FICHIERS_PAR_MODELE[modele] ?? ['mp3_propre_url']
  const urls: { label: string; url: string }[] = []
  const titre = beat.titre ?? 'beat'

  for (const champ of champs) {
    const fileUrl = beat[champ]
    if (!fileUrl) continue

    const ext = EXTENSION[champ] ?? 'bin'
    const filename = `${titre}.${ext}`
    const key = fileUrl.replace(PUBLIC_URL + '/', '')
    const signed = await getSignedUrl(
      r2,
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      }),
      { expiresIn: 3600 }
    )
    urls.push({ label: LABEL[champ] ?? champ, url: signed })
  }

  return urls
}

export async function uploadPdfContrat(commandeId: string, pdfBytes: Uint8Array): Promise<string> {
  const key = `commandes/${commandeId}/contrat.pdf`
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: Buffer.from(pdfBytes),
    ContentType: 'application/pdf',
  }))
  return `${PUBLIC_URL}/${key}`
}

export async function genererUrlSigneePdf(pdfUrl: string, filename = 'contrat.pdf'): Promise<string> {
  const key = pdfUrl.replace(PUBLIC_URL + '/', '')
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
    { expiresIn: 3600 }
  )
}
