// Rang 9e : écran d'attente du dashboard = squelette (blocs gris fixes de la
// forme de la page qui arrive), décision de Jake — pas de roue, pas
// d'animation. Affiché par les loading.tsx dès le clic, le menu reste en place.

function Bloc({ className = '' }: { className?: string }) {
  return <div className={`rounded-lg bg-gray-800/60 ${className}`} />
}

function EnTete() {
  return (
    <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between gap-4">
      <div className="space-y-2">
        <Bloc className="h-6 w-40" />
        <Bloc className="h-3 w-64 max-w-[60vw]" />
      </div>
      <Bloc className="h-9 w-32 hidden sm:block" />
    </div>
  )
}

function Onglets({ nombre }: { nombre: number }) {
  return (
    <div className="px-6 pt-5 flex flex-wrap gap-2">
      {Array.from({ length: nombre }, (_, i) => <Bloc key={i} className="h-8 w-20" />)}
    </div>
  )
}

function Cartes({ nombre }: { nombre: number }) {
  return (
    <div className="px-6 pt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: nombre }, (_, i) => <Bloc key={i} className="h-20" />)}
    </div>
  )
}

function Tableau({ lignes }: { lignes: number }) {
  return (
    <div className="px-6 py-5">
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="h-10 bg-gray-900 border-b border-gray-800" />
        {Array.from({ length: lignes }, (_, i) => (
          <div key={i} className="h-12 px-4 flex items-center gap-4 border-b border-gray-800/60 last:border-b-0">
            <Bloc className="h-7 w-7 rounded-full" />
            <Bloc className="h-3 w-1/4" />
            <Bloc className="h-3 w-1/5 hidden sm:block" />
            <Bloc className="h-3 w-16 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

function Cadre({ children, pleinEcran }: { children: React.ReactNode; pleinEcran?: boolean }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={pleinEcran ? 'min-h-screen bg-gray-950 text-white' : 'flex-1 flex flex-col'}
    >
      <span className="sr-only">Chargement…</span>
      {children}
    </div>
  )
}

// Page en tableau (Commandes, Beats, Segments…) : titre, onglets éventuels, chiffres éventuels, lignes
export function SqueletteTableau({ onglets = 0, cartes = 0, lignes = 8, pleinEcran = false }: { onglets?: number; cartes?: number; lignes?: number; pleinEcran?: boolean }) {
  return (
    <Cadre pleinEcran={pleinEcran}>
      <EnTete />
      {onglets > 0 && <Onglets nombre={onglets} />}
      {cartes > 0 && <Cartes nombre={cartes} />}
      <Tableau lignes={lignes} />
    </Cadre>
  )
}

// Analytics : sélecteur de période, chiffres, graphique
export function SqueletteAnalytics() {
  return (
    <Cadre>
      <EnTete />
      <Onglets nombre={8} />
      <Cartes nombre={4} />
      <div className="px-6 py-5">
        <Bloc className="h-64" />
      </div>
    </Cadre>
  )
}

// Fiche (un contact, une commande, une campagne…) : titre puis deux colonnes de blocs
export function SqueletteFiche() {
  return (
    <Cadre>
      <EnTete />
      <div className="px-6 py-5 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Bloc className="h-40" />
          <Bloc className="h-28" />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Bloc className="h-12" />
          <Bloc className="h-56" />
        </div>
      </div>
    </Cadre>
  )
}
