import { siteDeLaPage } from '@/lib/boutique-du-domaine'
import { BoutiqueArtisteProvider } from './_lib/BoutiqueArtiste'

export default async function ArtisteLayout({ children }: { children: React.ReactNode }) {
  const { slugDomaine } = await siteDeLaPage()
  return <BoutiqueArtisteProvider slugDomaine={slugDomaine}>{children}</BoutiqueArtisteProvider>
}
