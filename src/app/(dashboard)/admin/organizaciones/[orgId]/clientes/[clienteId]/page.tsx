'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function OrgClienteDetallePage() {
  const [org, setOrg] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [periodos, setPeriodos] = useState<any[]>([])
  const [resumenPeriodos, setResumenPeriodos] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  const formatNum = (n: number) =>
    n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })

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

      const { data: clienteData } = await supabase
        .from('clientes').select('*').eq('id', params.clienteId).single()
      setCliente(clienteData)

      const { data: periodosData } = await supabase
        .from('periodos').select('*').eq('cliente_id', params.clienteId)
        .order('anio', { ascending: false }).order('mes', { ascending: false })
      setPeriodos(periodosData || [])

      if (periodosData && periodosData.length > 0) {
        const resumen: Record<string, any> = {}
        for (const p of periodosData) {
          const { data: compras } = await supabase
            .from('facturas').select('tipo_doc, neto, iva, exento, total, tipo_compra')
            .eq('periodo_id', p.id)
          const { data: ventas } = await supabase
            .from('facturas_venta').select('tipo_doc, neto, iva, total')
            .eq('periodo_id', p.id)
          const fc = compras || []
          const fv = ventas || []
          resumen[p.id] = {
            total_compras: fc.length,
            total_ventas: fv.length,
            sin_clasificar: fc.filter(f => !f.tipo_compra).length,
            neto_compras: fc.reduce((s, f) => s + (f.neto || 0), 0),
            iva_compras: fc.reduce((s, f) => s + (f.iva || 0), 0),
            neto_ventas: fv.reduce((s, f) => s + (f.neto || 0), 0),
            iva_ventas: fv.reduce((s, f) => s + (f.iva || 0), 0),
          }
        }
        setResumenPeriodos(resumen)
      }
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
          <button
            onClick={() => router.push('/admin/organizaciones/' + params.orgId + '/clientes')}
            className="text-gray-400 hover:text-white text-sm"
          >
            ← Volver
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
          <span className="text-blue-600">🔍</span>
          <p className="text-blue-700 text-sm">Modo solo lectura — <strong>{org?.nombre}</strong> → <strong>{cliente?.nombre}</strong></p>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{cliente?.nombre}</h2>
          <p className="text-gray-500 text-sm">{cliente?.rut} · {cliente?.tipo === 'empresa' ? 'Empresa' : 'Persona Natural'}</p>
        </div>

        {periodos.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <p className="text-gray-400">Este cliente no tiene periodos aun</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="font-medium text-gray-900">Periodos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Periodo</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">Compras</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">Ventas</th>
                    <th className="text-right px-3 py-3 font-medium text-gray-500">Neto Compras</th>
                    <th className="text-right px-3 py-3 font-medium text-gray-500">IVA Credito</th>
                    <th className="text-right px-3 py-3 font-medium text-gray-500">Neto Ventas</th>
                    <th className="text-right px-3 py-3 font-medium text-gray-500">IVA Debito</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">Clasificacion</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {periodos.map(p => {
                    const r = resumenPeriodos[p.id] || {}
                    const completo = r.total_compras > 0 && r.sin_clasificar === 0
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          <td className="px-6 py-4 font-medium text-blue-600 cursor-pointer hover:text-blue-800"
                             onClick={() => router.push('/admin/organizaciones/' + params.orgId + '/clientes/' + params.clienteId + '/periodos/' + p.id)}
>
                               {meses[p.mes]} {p.anio}
                                </td>
                        </td>
                        <td className="px-3 py-4 text-center text-gray-600">{r.total_compras ?? '-'}</td>
                        <td className="px-3 py-4 text-center text-gray-600">{r.total_ventas ?? '-'}</td>
                        <td className="px-3 py-4 text-right text-gray-700">{r.neto_compras != null ? formatNum(r.neto_compras) : '-'}</td>
                        <td className="px-3 py-4 text-right text-blue-600 font-medium">{r.iva_compras != null ? formatNum(r.iva_compras) : '-'}</td>
                        <td className="px-3 py-4 text-right text-gray-700">{r.neto_ventas != null ? formatNum(r.neto_ventas) : '-'}</td>
                        <td className="px-3 py-4 text-right text-green-600 font-medium">{r.iva_ventas != null ? formatNum(r.iva_ventas) : '-'}</td>
                        <td className="px-3 py-4 text-center">
                          {r.total_compras > 0 ? (
                            completo ? (
                              <span className="text-green-600 text-xs font-medium">✓ Completo</span>
                            ) : (
                              <span className="text-yellow-600 text-xs font-medium">{r.sin_clasificar} pendientes</span>
                            )
                          ) : '-'}
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            p.estado === 'cerrado' ? 'bg-green-100 text-green-700' :
                            p.estado === 'revision' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {p.estado.charAt(0).toUpperCase() + p.estado.slice(1)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
