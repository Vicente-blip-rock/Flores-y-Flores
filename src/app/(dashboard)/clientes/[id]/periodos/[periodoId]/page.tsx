'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function PeriodoPage() {
  const [facturas, setFacturas] = useState<any[]>([])
  const [periodo, setPeriodo] = useState<any>(null)
  const [cliente, setCliente] = useState<any>(null)
  const [planCuentas, setPlanCuentas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [clasificando, setClasificando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [busquedaCuenta, setBusquedaCuenta] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
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

      const { data: facturasData } = await supabase
        .from('facturas').select('*').eq('periodo_id', params.periodoId).order('numero_linea')
      setFacturas(facturasData || [])

      const { data: cuentasData } = await supabase
        .from('plan_de_cuentas').select('nombre').eq('cliente_id', params.id).eq('activo', true)

      if (cuentasData && cuentasData.length > 0) {
        setPlanCuentas(cuentasData.map((c: any) => c.nombre))
      } else {
        const { data: cuentasBase } = await supabase
          .from('plan_base').select('nombre').eq('activo', true)
        setPlanCuentas((cuentasBase || []).map((c: any) => c.nombre))
      }

      setLoading(false)
    }
    cargar()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setEditando(null)
        setBusquedaCuenta('')
      }
    }
    if (editando) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editando])

  const clasificarConIA = async () => {
    const sinClasificar = facturas.filter(f => !f.tipo_compra)
    if (sinClasificar.length === 0) {
      setMensaje('Todas las facturas ya estan clasificadas')
      return
    }
    setClasificando(true)
    setMensaje('Clasificando ' + sinClasificar.length + ' facturas con IA...')
    try {
      const res = await fetch('/api/clasificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facturas: sinClasificar, plan_cuentas: planCuentas })
      })
      const data = await res.json()
      if (data.error) {
        setMensaje('Error: ' + data.error)
        setClasificando(false)
        return
      }
      for (const item of data.clasificaciones) {
        await supabase.from('facturas').update({
          tipo_compra: item.tipo_compra,
          clasificado_por: 'ia',
          ia_confianza: 0.85
        }).eq('id', item.id)
      }
      const { data: actualizadas } = await supabase
        .from('facturas').select('*').eq('periodo_id', params.periodoId).order('numero_linea')
      setFacturas(actualizadas || [])
      setMensaje('Listo: ' + data.clasificaciones.length + ' facturas clasificadas')
    } catch {
      setMensaje('Error de conexion con la IA')
    }
    setClasificando(false)
  }

  const cambiarCuenta = async (facturaId: string, cuenta: string) => {
    await supabase.from('facturas').update({
      tipo_compra: cuenta,
      clasificado_por: 'manual'
    }).eq('id', facturaId)
    setFacturas(prev => prev.map(f =>
      f.id === facturaId ? { ...f, tipo_compra: cuenta, clasificado_por: 'manual' } : f
    ))
    setEditando(null)
    setBusquedaCuenta('')
  }

  const cuentasFiltradas = planCuentas.filter(c =>
    c.toLowerCase().includes(busquedaCuenta.toLowerCase())
  )

  const totalNeto = facturas.reduce((sum, f) => sum + (f.neto || 0), 0)
  const totalIva = facturas.reduce((sum, f) => sum + (f.iva || 0), 0)
  const totalGeneral = facturas.reduce((sum, f) => sum + (f.total || 0), 0)
  const sinClasificar = facturas.filter(f => !f.tipo_compra).length

  const formatNum = (n: number) =>
    n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })

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
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-900">Asesorias Flores y Flores</h1>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => router.push('/clientes/' + params.id + '/periodos/' + params.periodoId + '/resumen')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            Ver resumen
          </button>
          <button onClick={() => router.push('/clientes/' + params.id)} className="text-sm text-gray-500 hover:text-gray-700">
            Volver
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{cliente?.nombre}</h2>
            <p className="text-gray-500 text-sm">{meses[periodo?.mes]} {periodo?.anio} - {facturas.length} facturas</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={clasificarConIA}
              disabled={clasificando || sinClasificar === 0}
              className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50"
            >
              {clasificando ? 'Clasificando...' : 'Clasificar con IA (' + sinClasificar + ')'}
            </button>
            {mensaje && <p className="text-sm text-gray-600">{mensaje}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
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
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h3 className="font-medium text-gray-900">Facturas</h3>
            <div className="flex items-center gap-4">
              {sinClasificar > 0 && (
                <span className="text-sm text-yellow-600 font-medium">{sinClasificar} sin clasificar</span>
              )}
              <span className="text-xs text-gray-400">Click en la cuenta para editar</span>
            </div>
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
                {facturas.map((f) => (
                  <tr key={f.id} className={f.tipo_compra ? 'hover:bg-gray-50' : 'bg-yellow-50 hover:bg-yellow-100'}>
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
                    <td className="px-4 py-3 relative">
                      {editando === f.id ? (
                        <div ref={menuRef} className="absolute z-10 left-0 top-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2 w-64">
                          <input
                            autoFocus
                            type="text"
                            placeholder="Buscar cuenta..."
                            value={busquedaCuenta}
                            onChange={e => setBusquedaCuenta(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-900"
                          />
                          <div className="max-h-56 overflow-y-auto">
                            {cuentasFiltradas.length === 0 ? (
                              <p className="text-xs text-gray-400 px-3 py-2">Sin resultados</p>
                            ) : (
                              cuentasFiltradas.map(cuenta => (
                                <button
                                  key={cuenta}
                                  onClick={() => cambiarCuenta(f.id, cuenta)}
                                  className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg"
                                >
                                  {cuenta}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditando(f.id); setBusquedaCuenta('') }}
                          className="text-left w-full"
                        >
                          {f.tipo_compra ? (
                            <span className={
                              f.clasificado_por === 'ia'
                                ? 'px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200'
                                : 'px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200'
                            }>
                              {f.tipo_compra}
                            </span>
                          ) : (
                            <span className="text-yellow-600 text-xs font-medium underline hover:text-yellow-700">
                              + Asignar cuenta
                            </span>
                          )}
                        </button>
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
