'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NuevaRendicionPage() {
  const [proyectos, setProyectos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [form, setForm] = useState({
    cliente_id: '',
    proyecto_id: '',
    rendidor_id: '',
    periodo_desde: '',
    periodo_hasta: '',
    observaciones: ''
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: clientesData } = await supabase
        .from('clientes').select('*').eq('activo', true).order('nombre')
      setClientes(clientesData || [])

      const { data: proyectosData } = await supabase
        .from('proyectos').select('*').eq('activo', true).order('nombre')
      setProyectos(proyectosData || [])

      const { data: usuariosData } = await supabase
        .from('usuarios').select('*').eq('activo', true).order('nombre')
      setUsuarios(usuariosData || [])

      setForm(prev => ({ ...prev, rendidor_id: user?.id || '' }))
    }
    cargar()
  }, [])

  const generarNumero = async () => {
    const anio = new Date().getFullYear()
    const { count } = await supabase
      .from('rendiciones')
      .select('*', { count: 'exact', head: true })
    return 'R-' + anio + '-' + String((count || 0) + 1).padStart(3, '0')
  }

  const handleGuardar = async () => {
    if (!form.rendidor_id) { setError('Selecciona quien va a rendir'); return }
    setGuardando(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: usuarioData } = await supabase
      .from('usuarios').select('organizacion_id').eq('id', user?.id).single()

    const numero = await generarNumero()

    const { data, error: err } = await supabase.from('rendiciones').insert({
      organizacion_id: usuarioData?.organizacion_id,
      numero,
      cliente_id: form.cliente_id || null,
      rendidor_id: form.rendidor_id,
      proyecto_id: form.proyecto_id || null,
      periodo_desde: form.periodo_desde || null,
      periodo_hasta: form.periodo_hasta || null,
      observaciones: form.observaciones,
      estado: 'borrador',
      total_solicitado: 0,
      total_aprobado: 0
    }).select().single()

    if (err) {
      setError('Hubo un error al crear la rendicion. Intenta de nuevo.')
      setGuardando(false)
    } else {
      router.push('/rendiciones/' + data.id)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/rendiciones')} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-lg font-bold text-gray-900">Nueva Rendicion de Gastos</h1>
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-6 py-8">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 mb-6">
          <p className="text-blue-800 text-sm font-medium">💡 ¿Qué es una rendicion?</p>
          <p className="text-blue-600 text-sm mt-1">Es un registro de los gastos que hiciste a nombre de la empresa. Una vez que la envíes, tu jefe la revisará y aprobará el reembolso.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">¿Quién rinde? *</label>
            <p className="text-xs text-gray-400 mb-2">La persona que hizo los gastos</p>
            <select
              value={form.rendidor_id}
              onChange={e => setForm({ ...form, rendidor_id: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar persona...</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Empresa</label>
            <p className="text-xs text-gray-400 mb-2">¿A qué empresa pertenecen estos gastos?</p>
            <select
              value={form.cliente_id}
              onChange={e => setForm({ ...form, cliente_id: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin empresa específica</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Proyecto o área</label>
            <p className="text-xs text-gray-400 mb-2">¿A qué proyecto se cargan estos gastos?</p>
            <select
              value={form.proyecto_id}
              onChange={e => setForm({ ...form, proyecto_id: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin proyecto específico</option>
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Período de los gastos</label>
            <p className="text-xs text-gray-400 mb-2">¿Entre qué fechas ocurrieron los gastos?</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Desde</label>
                <input type="date" value={form.periodo_desde}
                  onChange={e => setForm({ ...form, periodo_desde: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Hasta</label>
                <input type="date" value={form.periodo_hasta}
                  onChange={e => setForm({ ...form, periodo_hasta: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notas adicionales</label>
            <p className="text-xs text-gray-400 mb-2">Cualquier información que ayude a entender estos gastos</p>
            <textarea value={form.observaciones}
              onChange={e => setForm({ ...form, observaciones: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Ej: Gastos de viaje a reunión con cliente en Santiago..." />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={handleGuardar} disabled={guardando}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 text-sm">
              {guardando ? 'Creando rendicion...' : 'Crear rendicion →'}
            </button>
            <button onClick={() => router.push('/rendiciones')}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition text-sm">
              Cancelar
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
