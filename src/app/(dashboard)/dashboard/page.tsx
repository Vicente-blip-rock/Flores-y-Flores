'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: sa } = await supabase
        .from('super_admins').select('id').eq('id', session.user.id).single()
      setIsSuperAdmin(!!sa)

      const { data } = await supabase.from('clientes').select('*').order('nombre')
      setClientes(data || [])
      setLoading(false)
    }
    checkSession()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-900">Asesorias Flores y Flores</h1>
        <div className="flex items-center gap-4">
          {isSuperAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-700 transition"
            >
              Panel Admin
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Clientes</h2>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/carga-masiva')}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition"
            >
              📂 Carga masiva
            </button>
            <button
              onClick={() => router.push('/clientes/nuevo')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              + Nuevo cliente
            </button>
          </div>
        </div>

        {clientes.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <p className="text-gray-400 text-lg">No hay clientes aún</p>
            <p className="text-gray-400 text-sm mt-1">Agrega tu primer cliente para comenzar</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Nombre</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">RUT</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Tipo</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Estado</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-medium text-gray-900">{cliente.nombre}</td>
                    <td className="px-6 py-4 text-gray-500">{cliente.rut}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {cliente.tipo === 'empresa' ? 'Empresa' : 'Persona Natural'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        cliente.activo
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {cliente.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => router.push('/clientes/' + cliente.id)}
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
