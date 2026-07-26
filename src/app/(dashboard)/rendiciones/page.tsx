'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RendicionesPage() {
  const [rendiciones, setRendiciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [usuario, setUsuario] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: usuarioData } = await supabase
        .from('usuarios').select('*').eq('id', user.id).single()
      setUsuario(usuarioData)

      const { data } = await supabase
        .from('rendiciones')
        .select('*, proyectos(nombre), rendidor:rendidor_id(nombre)')
        .order('created_at', { ascending: false })
      setRendiciones(data || [])
      setLoading(false)
    }
    cargar()
  }, [])

  const estadoColor: Record<string, string> = {
    borrador: 'bg-gray-100 text-gray-600',
    enviada: 'bg-blue-100 text-blue-700',
    aprobada: 'bg-green-100 text-green-700',
    rechazada: 'bg-red-100 text-red-700',
    pagada: 'bg-purple-100 text-purple-700',
    cerrada: 'bg-gray-200 text-gray-500',
  }

  const formatNum = (n: number) =>
    n?.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }) || '$0'

  const resumen = {
    total: rendiciones.length,
    borrador: rendiciones.filter(r => r.estado === 'borrador').length,
    enviada: rendiciones.filter(r => r.estado === 'enviada').length,
    aprobada: rendiciones.filter(r => r.estado === 'aprobada').length,
    monto_total: rendiciones.reduce((s, r) => s + (r.total_solicitado || 0), 0),
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-900">ContAI</h1>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push('/rendiciones/nueva')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + Nueva rendicion
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Rendiciones de Gastos</h2>
          <p className="text-gray-500 text-sm mt-1">Gestiona y controla las rendiciones de tu equipo</p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total rendiciones</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{resumen.total}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">En borrador</p>
            <p className="text-2xl font-bold text-gray-500 mt-1">{resumen.borrador}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Pendientes aprobacion</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{resumen.enviada}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Monto total</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatNum(resumen.monto_total)}</p>
          </div>
        </div>

        {rendiciones.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-gray-400 text-lg">No hay rendiciones aun</p>
            <p className="text-gray-400 text-sm mt-1">Crea tu primera rendicion para comenzar</p>
            <button
              onClick={() => router.push('/rendiciones/nueva')}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              + Nueva rendicion
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Rendidor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Proyecto</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Docs</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Solicitado</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Aprobado</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rendiciones.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-medium text-blue-600 cursor-pointer hover:text-blue-800"
                      onClick={() => router.push('/rendiciones/' + r.id)}>
                      {r.numero}
                    </td>
                    <td className="px-4 py-4 text-gray-700">{r.rendidor?.nombre || '-'}</td>
                    <td className="px-4 py-4 text-gray-500">{r.proyectos?.nombre || '-'}</td>
                    <td className="px-4 py-4 text-center text-gray-600">{r.total_documentos || 0}</td>
                    <td className="px-4 py-4 text-right text-gray-700">{formatNum(r.total_solicitado)}</td>
                    <td className="px-4 py-4 text-right text-green-600 font-medium">{formatNum(r.total_aprobado)}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColor[r.estado] || 'bg-gray-100 text-gray-600'}`}>
                        {r.estado.charAt(0).toUpperCase() + r.estado.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => router.push('/rendiciones/' + r.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Ver →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
