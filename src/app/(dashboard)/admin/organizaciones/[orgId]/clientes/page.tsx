'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function OrgClientesPage() {
  const [org, setOrg] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: sa } = await supabase
        .from('super_admins').select('id').eq('id', session.user.id).single()
      if (!sa) { router.push('/dashboard'); return }

      const { data: orgData } = await supabase
        .from('organizaciones').select('*').eq('id', params.orgId).single()
      setOrg(orgData)

      const { data: clientesData } = await supabase
        .from('clientes').select('*').eq('organizacion_id', params.orgId).order('nombre')
      setClientes(clientesData || [])
      setLoading(false)
    }
    cargar()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg">Panel Super Admin</span>
          <span className="bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-0.5 rounded">ADMIN</span>
          <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">Solo lectura</span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-gray-400 text-sm">Viendo: {org?.nombre}</span>
          <button onClick={() => router.push('/admin/organizaciones/' + params.orgId)} className="text-gray-400 hover:text-white text-sm">
            ← Volver
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
          <span className="text-blue-600">🔍</span>
          <p className="text-blue-700 text-sm">Estas en modo solo lectura — acceso de soporte para <strong>{org?.nombre}</strong></p>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Clientes de {org?.nombre}</h2>
          <span className="text-sm text-gray-500">{clientes.length} clientes</span>
        </div>

        {clientes.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <p className="text-gray-400">Esta organizacion no tiene clientes aun</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Nombre</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">RUT</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Tipo</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clientes.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{c.nombre}</td>
                    <td className="px-6 py-4 text-gray-500">{c.rut}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {c.tipo === 'empresa' ? 'Empresa' : 'Persona Natural'}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => router.push('/admin/organizaciones/' + params.orgId + '/clientes/' + c.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Ver periodos →
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
