'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AprobarRendicionesPage() {
  const [rendiciones, setRendiciones] = useState<any[]>([])
  const [rendicionActiva, setRendicionActiva] = useState<any>(null)
  const [gastos, setGastos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [comentario, setComentario] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const formatNum = (n: number) =>
    n?.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }) || '$0'

  const cargarPendientes = async () => {
    const { data } = await supabase
      .from('rendiciones')
      .select('*, rendidor:rendidor_id(nombre), clientes(nombre), proyectos(nombre)')
      .eq('estado', 'enviada')
      .order('created_at')
    setRendiciones(data || [])
    setLoading(false)
  }

  const cargarGastos = async (rendicionId: string) => {
    const { data } = await supabase
      .from('gastos_rendicion')
      .select('*, categorias_gasto(nombre, icono)')
      .eq('rendicion_id', rendicionId)
      .order('fecha')
    setGastos(data || [])
  }

  useEffect(() => { cargarPendientes() }, [])

  const seleccionarRendicion = async (r: any) => {
    setRendicionActiva(r)
    await cargarGastos(r.id)
    setComentario('')
  }

  const aprobarRendicion = async () => {
    if (!rendicionActiva) return
    setProcesando(true)
    const totalAprobado = gastos.filter(g => g.estado !== 'rechazado').reduce((s, g) => s + (g.total || 0), 0)
    await supabase.from('rendiciones').update({
      estado: 'aprobada',
      total_aprobado: totalAprobado,
      observaciones: comentario || null,
      fecha_aprobacion: new Date().toISOString().split('T')[0]
    }).eq('id', rendicionActiva.id)
    await cargarPendientes()
    setRendicionActiva(null)
    setGastos([])
    setProcesando(false)
  }

  const rechazarRendicion = async () => {
    if (!rendicionActiva) return
    if (!comentario.trim()) { alert('Debes agregar un comentario explicando el rechazo'); return }
    setProcesando(true)
    await supabase.from('rendiciones').update({
      estado: 'rechazada',
      observaciones: comentario
    }).eq('id', rendicionActiva.id)
    await cargarPendientes()
    setRendicionActiva(null)
    setGastos([])
    setProcesando(false)
  }

  const aprobarGasto = async (gastoId: string) => {
    await supabase.from('gastos_rendicion').update({ estado: 'aprobado' }).eq('id', gastoId)
    await cargarGastos(rendicionActiva.id)
  }

  const rechazarGasto = async (gastoId: string) => {
    await supabase.from('gastos_rendicion').update({ estado: 'rechazado' }).eq('id', gastoId)
    await cargarGastos(rendicionActiva.id)
  }

  const verFoto = async (imagenUrl: string) => {
    const { data } = await supabase.storage.from('comprobantes').createSignedUrl(imagenUrl, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/rendiciones')} className="text-gray-400 hover:text-gray-600">
            &larr;
          </button>
          <h1 className="text-lg font-bold text-gray-900">Rendiciones por aprobar</h1>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {rendiciones.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center shadow-sm">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-gray-700 text-lg font-medium">No hay rendiciones pendientes</p>
            <p className="text-gray-400 text-sm mt-2">Todo al dia — no hay nada que aprobar por ahora</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1">
              <h3 className="font-medium text-gray-700 mb-3">Pendientes ({rendiciones.length})</h3>
              <div className="space-y-2">
                {rendiciones.map(r => (
                  <div
                    key={r.id}
                    onClick={() => seleccionarRendicion(r)}
                    className={'bg-white rounded-xl p-4 cursor-pointer border-2 transition ' + (rendicionActiva?.id === r.id ? 'border-blue-500 shadow-md' : 'border-transparent hover:border-gray-200 shadow-sm')}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{r.numero}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{r.rendidor?.nombre}</p>
                        {r.clientes?.nombre && (
                          <p className="text-xs text-blue-600 mt-0.5">{r.clientes.nombre}</p>
                        )}
                      </div>
                      <p className="font-bold text-gray-900 text-sm">{formatNum(r.total_solicitado)}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(r.created_at).toLocaleDateString('es-CL')}
                    </p>
                    {r.observaciones && (
                      <p className="text-xs text-gray-500 mt-1 italic">{r.observaciones}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-2">
              {!rendicionActiva ? (
                <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                  <p className="text-gray-400">Selecciona una rendicion para revisarla</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-gray-900">{rendicionActiva.numero}</h3>
                        <p className="text-sm text-gray-500">
                          {rendicionActiva.rendidor?.nombre}
                          {rendicionActiva.proyectos?.nombre ? ' - ' + rendicionActiva.proyectos.nombre : ''}
                        </p>
                      </div>
                      <p className="text-xl font-bold text-gray-900">{formatNum(rendicionActiva.total_solicitado)}</p>
                    </div>
                  </div>

                  <div className="divide-y">
                    {gastos.map(g => (
                      <div key={g.id} className={'px-6 py-4 ' + (g.estado === 'rechazado' ? 'bg-red-50' : g.estado === 'aprobado' ? 'bg-green-50' : '')}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 text-sm">{g.proveedor || 'Sin proveedor'}</p>
                              {g.categorias_gasto && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                  {g.categorias_gasto.icono} {g.categorias_gasto.nombre}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {g.tipo_doc} {g.folio ? '#' + g.folio : ''} - {g.fecha}
                            </p>
                            {g.concepto && <p className="text-xs text-gray-600 mt-1">{g.concepto}</p>}
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            {g.imagen_url && (
                              <button onClick={() => verFoto(g.imagen_url)}
                                className="text-blue-600 hover:text-blue-800 text-sm">
                                📄
                              </button>
                            )}
                            <p className="font-bold text-gray-900">{formatNum(g.total)}</p>
                            {g.estado === 'borrador' && (
                              <div className="flex gap-1">
                                <button onClick={() => aprobarGasto(g.id)}
                                  className="bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded text-xs font-medium">
                                  OK
                                </button>
                                <button onClick={() => rechazarGasto(g.id)}
                                  className="bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1 rounded text-xs font-medium">
                                  No
                                </button>
                              </div>
                            )}
                            {g.estado === 'aprobado' && <span className="text-green-600 text-xs font-medium">Aprobado</span>}
                            {g.estado === 'rechazado' && <span className="text-red-600 text-xs font-medium">Rechazado</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="px-6 py-4 border-t bg-gray-50">
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Comentario (obligatorio si rechazas)
                      </label>
                      <textarea
                        value={comentario}
                        onChange={e => setComentario(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Agrega un comentario para el empleado..."
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={aprobarRendicion}
                        disabled={procesando}
                        className="flex-1 bg-green-600 text-white py-2 rounded-xl font-medium hover:bg-green-700 transition disabled:opacity-50 text-sm"
                      >
                        Aprobar rendicion
                      </button>
                      <button
                        onClick={rechazarRendicion}
                        disabled={procesando}
                        className="flex-1 bg-red-500 text-white py-2 rounded-xl font-medium hover:bg-red-600 transition disabled:opacity-50 text-sm"
                      >
                        Rechazar rendicion
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
