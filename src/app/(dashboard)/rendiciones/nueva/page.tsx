'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NuevaRendicionPage() {
  const [proyectos, setProyectos] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [form, setForm] = useState({
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
      const { data: usuarioData } = await supabase
        .from('usuarios').select('*').eq('id', user?.id).single()

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
    const numero = 'R-' + anio + '-' + String((count || 0) + 1).padStart(3, '0')
    return numero
  }

  const handleGuardar = async () => {
    if (!form.rendidor_id) { setError('Selecciona un rendidor'); return }
    setGuardando(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: usuarioData } = await supabase
      .from('usuarios').select('organizacion_id').eq('id', user?.id).single()

    const numero = await generarNumero()

    const { data, error: err } = await supabase.from('rendiciones').insert({
      organizacion_id: usuarioData?.organizacion_id,
      numero,
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
      setError('Error al crear rendicion: ' + err.message)
      setGuardando(false)
    } else {
      router.push('/rendiciones/' + data.id)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-900">ContAI</h1>
        <button onClick={() => router.push('/rendiciones')} className="text-sm text-gray-500 hover:text-gray-700">
          ← Volver
        </button>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Nueva Rendicion</h2>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rendidor *</label>
            <select
              value={form.rendidor_id}
              onChange={e => setForm({ ...form, rendidor_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar...</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
            <select
              value={form.proyecto_id}
              onChange={e => setForm({ ...form, proyecto_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin proyecto</option>
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Periodo desde</label>
              <input
                type="date"
                value={form.periodo_desde}
                onChange={e => setForm({ ...form, periodo_desde: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Periodo hasta</label>
              <input
                type="date"
                value={form.periodo_hasta}
                onChange={e => setForm({ ...form, periodo_hasta: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={e => setForm({ ...form, observaciones: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Descripcion o contexto de la rendicion..."
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {guardando ? 'Creando...' : 'Crear rendicion'}
            </button>
            <button
              onClick={() => router.push('/rendiciones')}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
