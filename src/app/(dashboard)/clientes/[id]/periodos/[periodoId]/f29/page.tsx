'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function F29Page() {
  const [compras, setCompras] = useState<any[]>([])
  const [ventas, setVentas] = useState<any[]>([])
  const [periodo, setPeriodo] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  useEffect(() => {
    const cargar = async () => {
      const { data: periodoData } = await supabase
        .from('periodos').select('*').eq('id', params.periodoId).single()
      setPeriodo(periodoData)

      const { data: clienteData } = await supabase
        .from('clientes').select('*').eq('id', params.id).single()
      setCliente(clienteData)

      const { data: comprasData } = await supabase
        .from('facturas').select('*').eq('periodo_id', params.periodoId)
      setCompras(comprasData || [])

      const { data: ventasData } = await supabase
        .from('facturas_venta').select('*').eq('periodo_id', params.periodoId)
      setVentas(ventasData || [])

      setLoading(false)
    }
    cargar()
  }, [])

  const formatNum = (n: number) =>
    n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })

  const fmt = (n: number) => Math.round(n).toLocaleString('es-CL')

  // VENTAS - Debito fiscal
  const ventasAfectas = ventas.filter(v => v.tipo_doc === 33 && v.tipo_venta !== 'Activo Fijo')
  const ventasExentas = ventas.filter(v => v.tipo_doc === 34)
  const notasCreditoEmitidas = ventas.filter(v => v.tipo_doc === 61)

  const netoVentasAfectas = ventasAfectas.reduce((s, v) => s + (v.neto || 0), 0)
  const ivaDebito = ventasAfectas.reduce((s, v) => s + (v.iva || 0), 0)
  const netoVentasExentas = ventasExentas.reduce((s, v) => s + (v.exento || 0), 0)
  const ivaNotasCreditoEmitidas = notasCreditoEmitidas.reduce((s, v) => s + (v.iva || 0), 0)
  const totalDebito = ivaDebito - ivaNotasCreditoEmitidas

  // COMPRAS - Credito fiscal
  const comprasAfectas = compras.filter(c => c.tipo_doc === 33)
  const comprasExentas = compras.filter(c => c.tipo_doc === 34)
  const notasCreditoRecibidas = compras.filter(c => c.tipo_doc === 61)

  const netoComprasAfectas = comprasAfectas.reduce((s, c) => s + (c.neto || 0), 0)
  const ivaCredito = comprasAfectas.reduce((s, c) => s + (c.iva || 0), 0)
  const netoComprasExentas = comprasExentas.reduce((s, c) => s + (c.exento || 0), 0)
  const ivaNotasCreditoRecibidas = notasCreditoRecibidas.reduce((s, c) => s + (c.iva || 0), 0)
  const totalCredito = ivaCredito - ivaNotasCreditoRecibidas

  // RESULTADO
  const ivaAPagar = totalDebito - totalCredito
  const sinClasificar = compras.filter(c => !c.tipo_compra).length

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-900">Asesorias Flores y Flores</h1>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => router.push('/clientes/' + params.id + '/periodos/' + params.periodoId + '/resumen')}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Ver resumen compras
          </button>
          <button onClick={() => router.push('/clientes/' + params.id)} className="text-sm text-gray-500 hover:text-gray-700">
            Volver
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{cliente?.nombre}</h2>
            <p className="text-gray-500 text-sm">Preparación F29 — {meses[periodo?.mes]} {periodo?.anio}</p>
          </div>
          {sinClasificar > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2">
              <p className="text-yellow-700 text-sm font-medium">⚠️ {sinClasificar} compras sin clasificar</p>
            </div>
          )}
        </div>

        {ventas.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
            <p className="text-yellow-700 text-sm font-medium">⚠️ No hay libro de ventas cargado para este período. El débito fiscal será 0.</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <p className="text-sm text-green-700 font-medium">IVA Débito (ventas)</p>
            <p className="text-2xl font-bold text-green-800 mt-1">{formatNum(totalDebito)}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <p className="text-sm text-blue-700 font-medium">IVA Crédito (compras)</p>
            <p className="text-2xl font-bold text-blue-800 mt-1">{formatNum(totalCredito)}</p>
          </div>
          <div className={`rounded-2xl p-5 border ${ivaAPagar > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <p className={`text-sm font-medium ${ivaAPagar > 0 ? 'text-red-700' : 'text-green-700'}`}>
              {ivaAPagar > 0 ? 'IVA a Pagar' : 'Remanente CF'}
            </p>
            <p className={`text-2xl font-bold mt-1 ${ivaAPagar > 0 ? 'text-red-800' : 'text-green-800'}`}>
              {formatNum(Math.abs(ivaAPagar))}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-3 bg-green-600">
              <h3 className="font-semibold text-white">DÉBITOS Y VENTAS</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-2 font-medium text-gray-500">Concepto</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-500">Código SII</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-500">N° Docs</th>
                  <th className="text-right px-6 py-2 font-medium text-gray-500">Monto Neto</th>
                  <th className="text-right px-6 py-2 font-medium text-gray-500">Débito IVA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-800">Facturas emitidas del giro</td>
                  <td className="px-4 py-3 text-center text-gray-500 font-mono">585 / 20</td>
                  <td className="px-4 py-3 text-center text-gray-600">{ventasAfectas.length}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{fmt(netoVentasAfectas)}</td>
                  <td className="px-6 py-3 text-right font-medium text-green-700">{fmt(ivaDebito)}</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-800">Ventas exentas o no gravadas</td>
                  <td className="px-4 py-3 text-center text-gray-500 font-mono">586 / 142</td>
                  <td className="px-4 py-3 text-center text-gray-600">{ventasExentas.length}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{fmt(netoVentasExentas)}</td>
                  <td className="px-6 py-3 text-right text-gray-400">—</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-800">Notas de crédito emitidas</td>
                  <td className="px-4 py-3 text-center text-gray-500 font-mono">509 / 510</td>
                  <td className="px-4 py-3 text-center text-gray-600">{notasCreditoEmitidas.length}</td>
                  <td className="px-6 py-3 text-right text-gray-700">—</td>
                  <td className="px-6 py-3 text-right font-medium text-red-600">-{fmt(ivaNotasCreditoEmitidas)}</td>
                </tr>
                <tr className="bg-green-50 font-bold">
                  <td className="px-6 py-3 text-green-800">TOTAL DÉBITO FISCAL</td>
                  <td className="px-4 py-3 text-center text-gray-500 font-mono">538</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-6 py-3"></td>
                  <td className="px-6 py-3 text-right text-green-800">{fmt(totalDebito)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-3 bg-blue-600">
              <h3 className="font-semibold text-white">CRÉDITOS Y COMPRAS</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-2 font-medium text-gray-500">Concepto</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-500">Código SII</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-500">N° Docs</th>
                  <th className="text-right px-6 py-2 font-medium text-gray-500">Monto Neto</th>
                  <th className="text-right px-6 py-2 font-medium text-gray-500">Crédito IVA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-800">Facturas recibidas del giro</td>
                  <td className="px-4 py-3 text-center text-gray-500 font-mono">519 / 520</td>
                  <td className="px-4 py-3 text-center text-gray-600">{comprasAfectas.length}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{fmt(netoComprasAfectas)}</td>
                  <td className="px-6 py-3 text-right font-medium text-blue-700">{fmt(ivaCredito)}</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-800">Compras exentas o no gravadas</td>
                  <td className="px-4 py-3 text-center text-gray-500 font-mono">560</td>
                  <td className="px-4 py-3 text-center text-gray-600">{comprasExentas.length}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{fmt(netoComprasExentas)}</td>
                  <td className="px-6 py-3 text-right text-gray-400">—</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-800">Notas de crédito recibidas</td>
                  <td className="px-4 py-3 text-center text-gray-500 font-mono">527 / 528</td>
                  <td className="px-4 py-3 text-center text-gray-600">{notasCreditoRecibidas.length}</td>
                  <td className="px-6 py-3 text-right text-gray-700">—</td>
                  <td className="px-6 py-3 text-right font-medium text-red-600">-{fmt(ivaNotasCreditoRecibidas)}</td>
                </tr>
                <tr className="bg-blue-50 font-bold">
                  <td className="px-6 py-3 text-blue-800">TOTAL CRÉDITO FISCAL</td>
                  <td className="px-4 py-3 text-center text-gray-500 font-mono">537</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-6 py-3"></td>
                  <td className="px-6 py-3 text-right text-blue-800">{fmt(totalCredito)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={`rounded-2xl p-6 ${ivaAPagar > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            <div className="flex justify-between items-center">
              <div>
                <p className={`text-lg font-bold ${ivaAPagar > 0 ? 'text-red-800' : 'text-green-800'}`}>
                  {ivaAPagar > 0 ? 'IVA A PAGAR (Código 91)' : 'REMANENTE CRÉDITO FISCAL (Código 77)'}
                </p>
                <p className="text-sm text-gray-500 mt-1">Débito {fmt(totalDebito)} − Crédito {fmt(totalCredito)}</p>
              </div>
              <p className={`text-3xl font-bold ${ivaAPagar > 0 ? 'text-red-700' : 'text-green-700'}`}>
                {formatNum(Math.abs(ivaAPagar))}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
