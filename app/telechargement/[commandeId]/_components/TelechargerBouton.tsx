'use client'

export default function TelechargerBouton({
  label,
  url,
  icon = 'file',
  commandeId,
  ligneId,
}: {
  label: string
  url: string
  icon?: 'file' | 'pdf'
  commandeId?: string
  ligneId?: string
}) {
  function handleClick() {
    if (commandeId) {
      // keepalive garantit que la requête survit même si le navigateur
      // déclenche un téléchargement cross-origin juste après le clic
      fetch(`/api/telechargement/${commandeId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fichier: label, ligne_id: ligneId }),
        keepalive: true,
      }).catch(() => {})
    }
  }

  return (
    <a
      href={url}
      download
      onClick={handleClick}
      className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${icon === 'pdf' ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
          {icon === 'pdf' ? 'PDF' : label.slice(0, 3).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
      <svg className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </a>
  )
}
