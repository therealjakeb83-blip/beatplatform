export default function ComingSoon({ titre }: { titre: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-2">{titre}</h1>
      <p className="text-gray-500">En cours de construction…</p>
    </div>
  )
}
