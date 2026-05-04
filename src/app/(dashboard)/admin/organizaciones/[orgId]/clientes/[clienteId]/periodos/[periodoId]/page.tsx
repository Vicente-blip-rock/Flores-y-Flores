'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function AdminPeriodoPage() {
  const [facturas, setFacturas] = useState<any[]>([])
  const [periodo, setPeriodo] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [org, setOrg] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

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

      const { data: periodoData } = await supabase
        .from('periodos').select('*').eq('id', params.periodoId).single()
      setPeriodo(periodoData)

      const { data: facturasData } = await supabase
        .from('facturas').select('*').eq('periodo_id', params.periodoId).order('numero_linea')
      setFacturas(facturasData || [])

      setLoading(false)
    }
    cargar()
  }, [])

  const formatNum = (n: number) =>
    n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })

  const totalNeto = facturas.reduce((s, f) => s + (f.neto || 0), 0)
  const totalIva = facturas.reduce((s, f) => s + (f.iva || 0), 0)
  const totalGeneral = facturas.reduce((s, f) => s + (f.total || 0), 0)
  const sinClasificar = facturas.filter(f => !f.tipo_compra).length

  const tipoDoc: Record<number, string> = {
    33: 'Factura', 34: 'Fact. Exenta', 61: 'Nota Credito', 914: 'Otros'
  }

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
          <span className="text-gray-400 text-sm">{org?.nombre} → {cliente?.nombre}</span>
          <button
            onClick={() => router.push('/admin/organizaciones/' + params.orgId + '/clientes/' + params.clienteId)}
            className="text-gray-400 hover:text-white text-sm"
          >
            ← Volver
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
          <span className="text-blue-600">🔍</span>
          <p className="text-blue-700 text-sm">Modo solo lectura — <strong>{org?.nombre}</strong> → <strong>{cliente?.nombre}</strong> → <strong>{meses[periodo?.mes]} {periodo?.anio}</strong></p>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{cliente?.nombre}</h2>
          <p className="text-gray-500 text-sm">{meses[periodo?.mes]} {periodo?.anio} · {facturas.length} facturas</p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Neto total</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatNum(totalNeto)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">IVA total</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatNum(totalIva)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total general</p>
            <p className="text-xl font-bold text-blue-600 mt-1">{formatNum(totalGeneral)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Sin clasificar</p>
            <p className={`text-xl font-bold mt-1 ${sinClasificar > 0 ? 'text-yellow-500' : 'text-green-600'}`}>
              {sinClasificar === 0 ? '✓ Completo' : sinClasificar}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="font-medium text-gray-900">Facturas — solo lectura</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">N</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">RUT</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Proveedor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Folio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Neto</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">IVA</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Cuenta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturas.map(f => (
                  <tr key={f.id} className={f.tipo_compra ? 'hover:bg-gray-50' : 'bg-yellow-50'}>
                    <td className="px-4 py-3 text-gray-500">{f.numero_linea}</td>
                    <td className="px-4 py-3">
                      <span className={
                        f.tipo_doc === 61 ? 'px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700' :
                        f.tipo_doc === 34 ? 'px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600' :
                        'px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700'
                      }>
                        {tipoDoc[f.tipo_doc] || f.tipo_doc}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{f.rut_proveedor}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{f.razon_social}</td>
                    <td className="px-4 py-3 text-gray-500">{f.folio}</td>
                    <td className="px-4 py-3 text-gray-500">{f.fecha}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatNum(f.neto)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatNum(f.iva)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatNum(f.total)}</td>
                    <td className="px-4 py-3">
                      {f.tipo_compra ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          f.clasificado_por === 'ia' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {f.tipo_compra}
                        </span>
                      ) : (
                        <span className="text-yellow-500 text-xs">Sin clasificar</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
