'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function ResumenPage() {
  const [facturas, setFacturas] = useState<any[]>([])
  const [ventas, setVentas] = useState<any[]>([])
  const [periodo, setPeriodo] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const [cuentasExpandidas, setCuentasExpandidas] = useState<Record<string, boolean>>({})

  const toggleCuenta = (cuenta: string) => {
    setCuentasExpandidas(prev => ({ ...prev, [cuenta]: !prev[cuenta] }))
  }
  const params = useParams()
  const supabase = createClient()

  const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  const exportarExcel = async () => {
    const res = await fetch('/api/exportar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facturas, ventas, cliente, periodo, meses })
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (cliente?.nombre || 'libro') + '_' + (meses[periodo?.mes] || '') + '_' + (periodo?.anio || '') + '.xlsx'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  useEffect(() => {
    const cargar = async () => {
      const { data: periodoData } = await supabase
        .from('periodos').select('*').eq('id', params.periodoId).single()
      setPeriodo(periodoData)

      const { data: clienteData } = await supabase
        .from('clientes').select('*').eq('id', params.id).single()
      setCliente(clienteData)

      const { data: facturasData } = await supabase
        .from('facturas').select('*').eq('periodo_id', params.periodoId)
      setFacturas(facturasData || [])

      const { data: ventasData } = await supabase
        .from('facturas_venta').select('*').eq('periodo_id', params.periodoId)
      setVentas(ventasData || [])
      setLoading(false)
    }
    cargar()
  }, [])

  const formatNum = (n: number) =>
    n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })

  const resumenPorCuenta = () => {
    const mapa: Record<string, { exento: number, neto: number, iva: number, total: number, cantidad: number }> = {}
    for (const f of facturas) {
      const cuenta = f.tipo_compra || 'SIN CLASIFICAR'
      if (!mapa[cuenta]) mapa[cuenta] = { exento: 0, neto: 0, iva: 0, total: 0, cantidad: 0 }
      mapa[cuenta].exento += f.exento || 0
      mapa[cuenta].neto += f.neto || 0
      mapa[cuenta].iva += f.iva || 0
      mapa[cuenta].total += f.total || 0
      mapa[cuenta].cantidad += 1
    }
    return Object.entries(mapa).sort((a, b) => b[1].total - a[1].total)
  }

  const resumenTipoDoc = () => {
    const afectas = facturas.filter(f => f.tipo_doc === 33)
    const exentas = facturas.filter(f => f.tipo_doc === 34)
    const notasCredito = facturas.filter(f => f.tipo_doc === 61)
    return { afectas, exentas, notasCredito }
  }

  const totalNeto = facturas.reduce((sum, f) => sum + (f.neto || 0), 0)
  const totalIva = facturas.reduce((sum, f) => sum + (f.iva || 0), 0)
  const totalExento = facturas.reduce((sum, f) => sum + (f.exento || 0), 0)
  const totalGeneral = facturas.reduce((sum, f) => sum + (f.total || 0), 0)
  const sinClasificar = facturas.filter(f => !f.tipo_compra).length
  const { afectas, exentas, notasCredito } = resumenTipoDoc()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-900">Asesorias Flores y Flores</h1>
        <div className="flex gap-4">
          <button
            onClick={exportarExcel}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
          >
            📥 Exportar Excel
          </button>
          <button
            onClick={() => router.push('/clientes/' + params.id + '/periodos/' + params.periodoId)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Ver facturas
          </button>
          <button
            onClick={() => router.push('/clientes/' + params.id)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Volver
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{cliente?.nombre}</h2>
            <p className="text-gray-500 text-sm">Resumen {meses[periodo?.mes]} {periodo?.anio}</p>
          </div>
          {sinClasificar > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2">
              <p className="text-yellow-700 text-sm font-medium">
                {sinClasificar} facturas sin clasificar
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Exento</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatNum(totalExento)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Neto</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatNum(totalNeto)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">IVA</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatNum(totalIva)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-lg font-bold text-blue-600 mt-1">{formatNum(totalGeneral)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Facturas afectas (33)</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{afectas.length}</p>
            <p className="text-sm text-gray-500 mt-1">{formatNum(afectas.reduce((s, f) => s + f.total, 0))}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Facturas exentas (34)</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{exentas.length}</p>
            <p className="text-sm text-gray-500 mt-1">{formatNum(exentas.reduce((s, f) => s + f.total, 0))}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Notas de credito (61)</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{notasCredito.length}</p>
            <p className="text-sm text-gray-500 mt-1">{formatNum(notasCredito.reduce((s, f) => s + f.total, 0))}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b">
            <h3 className="font-medium text-gray-900">Resumen por cuenta</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Cuenta</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Facturas</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Exento</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Neto</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">IVA</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resumenPorCuenta().map(([cuenta, datos]) => {
                const facturasDeEstaCuenta = facturas.filter(f => (f.tipo_compra || 'SIN CLASIFICAR') === cuenta)
                const expandida = cuentasExpandidas[cuenta]
                return (
                  <>
                    <tr
                      key={cuenta}
                      className={(cuenta === 'SIN CLASIFICAR' ? 'bg-yellow-50' : 'hover:bg-gray-50') + ' cursor-pointer'}
                      onClick={() => toggleCuenta(cuenta)}
                    >
                      <td className="px-6 py-3 font-medium text-gray-900">
                        <span className="mr-2 text-gray-400">{expandida ? '▼' : '▶'}</span>
                        {cuenta === 'SIN CLASIFICAR' ? (
                          <span className="text-yellow-600">{cuenta}</span>
                        ) : cuenta}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">{datos.cantidad}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatNum(datos.exento)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatNum(datos.neto)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatNum(datos.iva)}</td>
                      <td className="px-6 py-3 text-right font-bold text-gray-900">{formatNum(datos.total)}</td>
                    </tr>
                    {expandida && facturasDeEstaCuenta.map(f => (
                      <tr key={f.id} className="bg-blue-50 text-xs">
                        <td className="px-10 py-2 text-gray-600">{f.razon_social}</td>
                        <td className="px-4 py-2 text-center text-gray-400">{f.folio}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{formatNum(f.exento || 0)}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{formatNum(f.neto || 0)}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{formatNum(f.iva || 0)}</td>
                        <td className="px-6 py-2 text-right text-gray-700">{formatNum(f.total || 0)}</td>
                      </tr>
                    ))}
                  </>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td className="px-6 py-3 font-bold text-gray-900">TOTAL</td>
                <td className="px-4 py-3 text-center font-bold text-gray-900">{facturas.length}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">{formatNum(totalExento)}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">{formatNum(totalNeto)}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">{formatNum(totalIva)}</td>
                <td className="px-6 py-3 text-right font-bold text-blue-600">{formatNum(totalGeneral)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </main>
    </div>
  )
}
