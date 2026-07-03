'use client'

import Link from 'next/link'
import type { TemplateRow } from '../page'
import { CATEGORIE_LABEL, CATEGORIE_CLS } from '../../_lib/categories'

type Props = {
  templates: TemplateRow[]
  dupliquerTemplate: (fd: FormData) => Promise<void>
  supprimerTemplate: (fd: FormData) => Promise<void>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TemplatesClient({ templates, dupliquerTemplate, supprimerTemplate }: Props) {
  const officiels = templates.filter(t => t.source === 'plateforme')
  const perso = templates.filter(t => t.source === 'beatmaker')

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-800 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white">Templates</h1>
          <p className="text-xs text-gray-500 mt-0.5">Modèles d&apos;emails réutilisables pour tes campagnes</p>
        </div>
        <Link
          href="/dashboard/business/marketing/templates/nouveau"
          className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
        >
          + Nouveau template
        </Link>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <Section titre="Modèles officiels">
          {officiels.length === 0 ? (
            <p className="text-sm text-gray-600 py-4">Aucun modèle officiel pour l&apos;instant.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {officiels.map(t => (
                <CarteTemplate key={t.id} t={t} dupliquerTemplate={dupliquerTemplate} supprimerTemplate={supprimerTemplate} />
              ))}
            </div>
          )}
        </Section>

        <Section titre="Mes templates">
          {perso.length === 0 ? (
            <p className="text-sm text-gray-600 py-4">
              Aucun template perso — duplique un modèle officiel ou crée le tien depuis zéro.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {perso.map(t => (
                <CarteTemplate key={t.id} t={t} dupliquerTemplate={dupliquerTemplate} supprimerTemplate={supprimerTemplate} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{titre}</h2>
      {children}
    </div>
  )
}

function CarteTemplate({ t, dupliquerTemplate, supprimerTemplate }: {
  t: TemplateRow
  dupliquerTemplate: (fd: FormData) => Promise<void>
  supprimerTemplate: (fd: FormData) => Promise<void>
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 flex flex-col gap-3 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORIE_CLS[t.categorie] ?? 'bg-gray-700 text-gray-300'}`}>
              {CATEGORIE_LABEL[t.categorie] ?? t.categorie}
            </span>
            {t.source === 'plateforme' && <span className="text-[10px] text-gray-600">Officiel</span>}
          </div>
          <p className="font-semibold text-white text-sm truncate">{t.nom}</p>
          {t.objet_defaut && <p className="text-xs text-gray-500 mt-0.5 truncate">{t.objet_defaut}</p>}
        </div>
        {t.source === 'beatmaker' && (
          <span className="text-[10px] text-gray-700 flex-shrink-0">{formatDate(t.created_at)}</span>
        )}
      </div>
      <div className="flex gap-2 pt-1 border-t border-gray-800 mt-auto">
        {t.source === 'plateforme' ? (
          <form action={dupliquerTemplate} className="flex-1">
            <input type="hidden" name="id" value={t.id} />
            <button type="submit" className="w-full py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
              Dupliquer
            </button>
          </form>
        ) : (
          <>
            <Link
              href={`/dashboard/business/marketing/templates/${t.id}`}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-center"
            >
              Modifier
            </Link>
            <form action={supprimerTemplate}>
              <input type="hidden" name="id" value={t.id} />
              <button
                type="submit"
                onClick={e => { if (!confirm(`Supprimer "${t.nom}" ?`)) e.preventDefault() }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors"
              >
                Supprimer
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
