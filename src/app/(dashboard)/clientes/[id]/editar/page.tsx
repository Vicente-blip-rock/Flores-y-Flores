'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function EditarClientePage() {
  const [form, setForm] = useState({
    nombre: '',
    rut: '',
    tipo: 'empresa',
    email: '',
    telefono: '',
    direccion: '',
    rubro: '',
    activo: true
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cargando, setCargando] = useState(true)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase.from('clientes').select('*').eq('id', params.id).single()
      if (data) setForm({
        nombre: data.nombre || '',
        rut: data.rut || '',
        tipo: data.tipo || 'empresa',
        email: data.email || '',
        telefono: data.telefono || '',
        direccion: data.direccion || '',
        rubro: data.rubro || '',
        activo: data.activo ?? true
      })
      setCargando(false)
    }
    cargar()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleGuardar = async () => {
    if (!form.nombre || !form.rut) {
      setError('Nombre y RUT son obligatorios')
      return
    }
    setLoading(true)
    setError('')

    const { error } = await supabase.from('clientes').update({
      nombre: form.nombre,
      rut: form.rut,
      tipo: form.tipo,
      email: form.email,
      telefono: form.telefono,
      direccion: form.direccion,
      rubro: form.rubro,
      activo: form.activo
    }).eq('id', params.id)

    if (error) {
      setError('Error al guardar: ' + error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-900">Asesorias Flores y Flores</h1>
        <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 hover:text-gray-700">
          Volver
        </button>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Editar Cliente</h2>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input name="nombre" value={form.nombre} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Razon social o nombre completo" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RUT *</label>
            <input name="rut" value={form.rut} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="12345678-9" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select name="tipo" value={form.tipo} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="empresa">Empresa</option>
              <option value="persona_natural">Persona Natural</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rubro</label>
            <input name="rubro" value={form.rubro} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Transporte, Educacion, Comercio, Construccion" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="cliente@email.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
            <input name="telefono" value={form.telefono} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+56 9 1234 5678" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
            <input name="direccion" value={form.direccion} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Calle 123, Ciudad" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select name="activo" value={form.activo ? 'true' : 'false'}
              onChange={e => setForm({ ...form, activo: e.target.value === 'true' })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={handleGuardar} disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={() => router.push('/dashboard')}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition">
              Cancelar
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
