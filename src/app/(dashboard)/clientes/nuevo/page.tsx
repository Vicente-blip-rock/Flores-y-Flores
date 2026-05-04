'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NuevoClientePage() {
  const [form, setForm] = useState({
    nombre: '',
    rut: '',
    tipo: 'empresa',
    email: '',
    telefono: '',
    direccion: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('organizacion_id')
      .single()

    const { error } = await supabase.from('clientes').insert({
      ...form,
      organizacion_id: usuario?.organizacion_id,
      activo: true
    })

    if (error) {
      setError('Error al guardar el cliente')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-900">Asesorías Flores y Flores</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Volver
        </button>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Nuevo Cliente</h2>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Razón social o nombre completo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RUT *</label>
            <input
              name="rut"
              value={form.rut}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="12345678-9"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              name="tipo"
              value={form.tipo}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="empresa">Empresa</option>
              <option value="persona_natural">Persona Natural</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="cliente@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+56 9 1234 5678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input
              name="direccion"
              value={form.direccion}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Calle 123, Ciudad"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleGuardar}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar cliente'}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
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
