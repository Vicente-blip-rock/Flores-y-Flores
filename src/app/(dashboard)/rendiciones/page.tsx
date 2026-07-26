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
        .select('*, proyectos(nombre), rendidor:rendidor_id(nombre), clientes(nombre)')
        .order('created_at', { ascending: false })
      setRendiciones(data || [])
      setLoading(false)
    }
    cargar()
  }, [])

  const estadoConfig: Record<string, { label: string, color: string, emoji: string }> = {
    borrador:  { label: 'Borrador',           color: 'bg-gray-100 text-gray-600',    emoji: '📝' },
    enviada:   { label: 'Esperando aprobacion', color: 'bg-blue-100 text-blue-700',  emoji: '⏳' },
    aprobada:  { label: 'Aprobada',            color: 'bg-green-100 text-green-700', emoji: '✅' },
    rechazada: { label: 'Rechazada',           color: 'bg-red-100 text-red-700',     emoji: '❌' },
    pagada:    { label: 'Pagada',              color: 'bg-purple-100 text-purple-700', emoji: '💰' },
    cerrada:   { label: 'Cerrada',             color: 'bg-gray-200 text-gray-500',   emoji: '🔒' },
  }

  const formatNum = (n: number) =>
    n?.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }) || '$0'

  const pendientes = rendiciones.filter(r => r.estado === 'enviada')
  const enProceso = rendiciones.filter(r => ['borrador', 'aprobada'].includes(r.estado))
  const montoTotal = rendiciones.filter(r => r.estado !== 'rechazada').reduce((s, r) => s + (r.total_solicitado || 0), 0)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-600">
            ←
          </button>
          <h1 className="text-lg font-bold text-gray-900">💼 Rendiciones de Gastos</h1>
        </div>
        <button
          onClick={() => router.push('/rendiciones/nueva')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + Nueva rendicion
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {pendientes.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl px-6 py-4 mb-6 flex justify-between items-center">
            <div>
              <p className="font-medium text-orange-800">⏳ Tienes {pendientes.length} rendicion{pendientes.length > 1 ? 'es' : ''} esperando tu aprobacion</p>
              <p className="text-orange-600 text-sm mt-0.5">Revísalas para que tus empleados reciban su reembolso</p>
            </div>
            <button
              onClick={() => router.push('/rendiciones/aprobar')}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition"
            >
              Ver pendientes
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total rendiciones</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{rendiciones.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Pendientes de aprobacion</p>
            <p className="text-3xl font-bold text-orange-500 mt-1">{pendientes.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Monto total</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatNum(montoTotal)}</p>
          </div>
        </div>

        {rendiciones.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center shadow-sm">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-gray-700 text-lg font-medium">No hay rendiciones aun</p>
            <p className="text-gray-400 text-sm mt-2 mb-6">Crea tu primera rendicion para empezar a controlar los gastos de tu equipo</p>
            <button
              onClick={() => router.push('/rendiciones/nueva')}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition"
            >
              + Crear primera rendicion
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rendiciones.map(r => {
              const cfg = estadoConfig[r.estado] || estadoConfig.borrador
              return (
                <div
                  key={r.id}
                  onClick={() => router.push('/rendiciones/' + r.id)}
                  className="bg-white rounded-2xl px-6 py-4 shadow-sm hover:shadow-md transition cursor-pointer flex justify-between items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">{cfg.emoji}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{r.numero}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {r.rendidor?.nombre || 'Sin rendidor'} 
                        {r.clientes?.nombre ? ' · ' + r.clientes.nombre : ''}
                        {r.proyectos?.nombre ? ' · ' + r.proyectos.nombre : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatNum(r.total_solicitado || 0)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(r.created_at).toLocaleDateString('es-CL')}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
