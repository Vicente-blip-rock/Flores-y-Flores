'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function ClientePage() {
  const [cliente, setCliente] = useState<any>(null)
  const [periodos, setPeriodos] = useState<any[]>([])
  const [resumenPeriodos, setResumenPeriodos] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [subiendoCompras, setSubiendoCompras] = useState(false)
  const [subiendoVentas, setSubiendoVentas] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [mensajeError, setMensajeError] = useState('')
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  const formatNum = (n: number) =>
    n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })

  const cargarDatos = async () => {
    const { data: clienteData } = await supabase
      .from('clientes').select('*').eq('id', params.id).single()
    setCliente(clienteData)

    const { data: periodosData } = await supabase
      .from('periodos').select('*').eq('cliente_id', params.id)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
    setPeriodos(periodosData || [])

    if (periodosData && periodosData.length > 0) {
      const resumen: Record<string, any> = {}
      for (const p of periodosData) {
        const { data: compras } = await supabase
          .from('facturas').select('tipo_doc, neto, iva, exento, total, tipo_compra')
          .eq('periodo_id', p.id)
        const { data: ventas } = await supabase
          .from('facturas_venta').select('tipo_doc, neto, iva, exento, total')
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
          afectas: fc.filter(f => f.tipo_doc === 33).length,
          exentas: fc.filter(f => f.tipo_doc === 34).length,
          notas_credito: fc.filter(f => f.tipo_doc === 61).length,
        }
      }
      setResumenPeriodos(resumen)
    }
    setLoading(false)
  }

  useEffect(() => { cargarDatos() }, [])

  const cambiarEstado = async (periodoId: string, estadoActual: string) => {
    const siguiente: Record<string, string> = {
      'borrador': 'revision', 'revision': 'cerrado', 'cerrado': 'borrador'
    }
    const nuevoEstado = siguiente[estadoActual] || 'borrador'
    await supabase.from('periodos').update({ estado: nuevoEstado }).eq('id', periodoId)
    setPeriodos(prev => prev.map(p => p.id === periodoId ? { ...p, estado: nuevoEstado } : p))
  }

  const parsearNumero = (val: string) => {
    if (!val || val.trim() === '-' || val.trim() === '') return 0
    return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0
  }

  const verificarLimite = async (cantidad: number) => {
    const { data: usuario } = await supabase
      .from('usuarios').select('organizacion_id').single()
    if (!usuario) return { ok: false, error: 'Usuario no encontrado' }

    const { data: org } = await supabase
      .from('organizaciones')
      .select('activo, documentos_mes_actual, mes_contador, anio_contador, planes(limite_documentos)')
      .eq('id', usuario.organizacion_id)
      .single()

    if (!org) return { ok: false, error: 'Organizacion no encontrada' }
    if (!org.activo) return { ok: false, error: 'Organizacion suspendida. Contacta al administrador.' }

    const ahora = new Date()
    const mesActual = ahora.getMonth() + 1
    const anioActual = ahora.getFullYear()
    const limite = (org.planes as any)?.limite_documentos || 999999

    let docsActuales = org.documentos_mes_actual || 0
    if (org.mes_contador !== mesActual || org.anio_contador !== anioActual) {
      docsActuales = 0
    }

    if (docsActuales + cantidad > limite) {
      return { ok: false, error: 'Limite de documentos del plan alcanzado (' + docsActuales + '/' + limite + '). Actualiza tu plan.' }
    }

    await supabase.rpc('incrementar_documentos', {
      org_id: usuario.organizacion_id,
      cantidad
    })

    return { ok: true }
  }

  const procesarCSVCompras = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim())
    const separador = lines[0].includes(';') ? ';' : ','
    const rows = lines.slice(1).filter(line => {
      const cols = line.split(separador)
      const primera = cols[0]?.trim().replace(/"/g, '')
      return cols.length > 3 && !isNaN(parseInt(primera)) && !line.toLowerCase().includes('total')
    })
    if (rows.length === 0) return null
    const primeraFila = rows[0].split(separador)
    const fechaRaw = primeraFila[5]?.trim().replace(/"/g, '') || ''
    const partes = fechaRaw.split('/')
    const mes = partes.length === 3 ? parseInt(partes[1]) : new Date().getMonth() + 1
    const anio = partes.length === 3 ? parseInt(partes[2]) : new Date().getFullYear()
    const facturas = rows.map((line, idx) => {
      const cols = line.split(separador).map(c => c.trim().replace(/"/g, ''))
      const fechaCols = cols[5]?.split('/') || []
      const fechaFormateada = fechaCols.length === 3
        ? `${fechaCols[2]}-${fechaCols[1].padStart(2, '0')}-${fechaCols[0].padStart(2, '0')}`
        : new Date().toISOString().split('T')[0]
      return {
        numero_linea: parseInt(cols[0]) || idx + 1,
        tipo_doc: parseInt(cols[1]) || 33,
        rut_proveedor: cols[2] || '',
        razon_social: cols[3] || '',
        folio: cols[4] || '',
        fecha: fechaFormateada,
        exento: parsearNumero(cols[6]),
        neto: parsearNumero(cols[7]),
        iva: parsearNumero(cols[8]),
        total: parsearNumero(cols[9]),
        iepd: parsearNumero(cols[10]),
      }
    })
    return { facturas, mes, anio }
  }

  const procesarCSVVentas = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim())
    const separador = lines[0].includes(';') ? ';' : ','
    const rows = lines.slice(1).filter(line => {
      const cols = line.split(separador)
      const primera = cols[0]?.trim().replace(/"/g, '')
      return cols.length > 3 && !isNaN(parseInt(primera)) && !line.toLowerCase().includes('total')
    })
    if (rows.length === 0) return null
    const primeraFila = rows[0].split(separador)
    const fechaRaw = primeraFila[6]?.trim().replace(/"/g, '') || ''
    const partes = fechaRaw.split('/')
    const mes = partes.length === 3 ? parseInt(partes[1]) : new Date().getMonth() + 1
    const anio = partes.length === 3 ? parseInt(partes[2]) : new Date().getFullYear()
    const ventas = rows.map((line, idx) => {
      const cols = line.split(separador).map(c => c.trim().replace(/"/g, ''))
      const fechaCols = cols[6]?.split('/') || []
      const fechaFormateada = fechaCols.length === 3
        ? `${fechaCols[2]}-${fechaCols[1].padStart(2, '0')}-${fechaCols[0].padStart(2, '0')}`
        : new Date().toISOString().split('T')[0]
      return {
        numero_linea: parseInt(cols[0]) || idx + 1,
        tipo_doc: parseInt(cols[1]) || 33,
        tipo_venta: cols[2] || '',
        rut_cliente: cols[3] || '',
        razon_social: cols[4] || '',
        folio: cols[5] || '',
        fecha: fechaFormateada,
        exento: parsearNumero(cols[10]),
        neto: parsearNumero(cols[11]),
        iva: parsearNumero(cols[12]),
        total: parsearNumero(cols[13]),
        iva_retenido_total: parsearNumero(cols[14]),
        iva_no_retenido: parsearNumero(cols[16]),
      }
    })
    return { ventas, mes, anio }
  }

  const handleCompras = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoCompras(true)
    setMensaje('')
    setMensajeError('')

    const text = await file.text()
    const resultado = procesarCSVCompras(text)
    if (!resultado) {
      setMensajeError('No se encontraron facturas en el archivo')
      setSubiendoCompras(false)
      return
    }

    const { facturas, mes, anio } = resultado
    const limite = await verificarLimite(facturas.length)
    if (!limite.ok) {
      setMensajeError(limite.error || 'Error de limite')
      setSubiendoCompras(false)
      return
    }

    const { data: periodoExistente } = await supabase
      .from('periodos').select('id').eq('cliente_id', params.id)
      .eq('anio', anio).eq('mes', mes).single()

    let periodoId = periodoExistente?.id
    if (!periodoId) {
      const { data: nuevoPeriodo } = await supabase
        .from('periodos').insert({ cliente_id: params.id, anio, mes, estado: 'borrador' })
        .select().single()
      periodoId = nuevoPeriodo?.id
    }

    const facturasConPeriodo = facturas.map(f => ({ ...f, periodo_id: periodoId }))
    await supabase.from('facturas').delete().eq('periodo_id', periodoId)
    const { error } = await supabase.from('facturas').insert(facturasConPeriodo)

    if (error) {
      setMensajeError('Error al guardar: ' + error.message)
    } else {
      setMensaje('✅ ' + facturas.length + ' compras importadas — ' + meses[mes] + ' ' + anio)
      await cargarDatos()
    }
    setSubiendoCompras(false)
  }

  const handleVentas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoVentas(true)
    setMensaje('')
    setMensajeError('')

    const text = await file.text()
    const resultado = procesarCSVVentas(text)
    if (!resultado) {
      setMensajeError('No se encontraron ventas en el archivo')
      setSubiendoVentas(false)
      return
    }

    const { ventas, mes, anio } = resultado
    const limite = await verificarLimite(ventas.length)
    if (!limite.ok) {
      setMensajeError(limite.error || 'Error de limite')
      setSubiendoVentas(false)
      return
    }

    const { data: periodoExistente } = await supabase
      .from('periodos').select('id').eq('cliente_id', params.id)
      .eq('anio', anio).eq('mes', mes).single()

    let periodoId = periodoExistente?.id
    if (!periodoId) {
      const { data: nuevoPeriodo } = await supabase
        .from('periodos').insert({ cliente_id: params.id, anio, mes, estado: 'borrador' })
        .select().single()
      periodoId = nuevoPeriodo?.id
    }

    const ventasConPeriodo = ventas.map(v => ({ ...v, periodo_id: periodoId }))
    await supabase.from('facturas_venta').delete().eq('periodo_id', periodoId)
    const { error } = await supabase.from('facturas_venta').insert(ventasConPeriodo)

    if (error) {
      setMensajeError('Error al guardar: ' + error.message)
    } else {
      setMensaje('✅ ' + ventas.length + ' ventas importadas — ' + meses[mes] + ' ' + anio)
      await cargarDatos()
    }
    setSubiendoVentas(false)
  }

  const estadoConfig: Record<string, { label: string, color: string }> = {
    borrador: { label: 'Borrador', color: 'bg-gray-100 text-gray-600' },
    revision: { label: 'En Revision', color: 'bg-yellow-100 text-yellow-700' },
    cerrado: { label: 'Cerrado', color: 'bg-green-100 text-green-700' },
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
        <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 hover:text-gray-700">
          Volver
        </button>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{cliente?.nombre}</h2>
          <p className="text-gray-500 text-sm">{cliente?.rut} · {cliente?.tipo === 'empresa' ? 'Persona Natural' : 'Empresa'}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="font-medium text-gray-900 mb-4">📥 Libro de Compras SII</h3>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-blue-400 transition">
              <span className="text-3xl mb-2">📂</span>
              <span className="text-gray-600 font-medium text-sm">Subir CSV de compras</span>
              <span className="text-gray-400 text-xs mt-1">RCV_COMPRA_*.csv</span>
              <input type="file" accept=".csv" onChange={handleCompras} className="hidden" />
            </label>
            {subiendoCompras && <p className="text-blue-600 text-sm mt-3 text-center">Procesando...</p>}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="font-medium text-gray-900 mb-4">📤 Libro de Ventas SII</h3>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-green-400 transition">
              <span className="text-3xl mb-2">📂</span>
              <span className="text-gray-600 font-medium text-sm">Subir CSV de ventas</span>
              <span className="text-gray-400 text-xs mt-1">RCV_VENTA_*.csv</span>
              <input type="file" accept=".csv" onChange={handleVentas} className="hidden" />
            </label>
            {subiendoVentas && <p className="text-green-600 text-sm mt-3 text-center">Procesando...</p>}
          </div>
        </div>

        {mensaje && <p className="text-sm mb-4 font-medium text-center text-green-600">{mensaje}</p>}
        {mensajeError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-700 text-sm font-medium">⚠️ {mensajeError}</p>
          </div>
        )}

        {periodos.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <p className="text-gray-400 text-lg">No hay períodos aún</p>
            <p className="text-gray-400 text-sm mt-1">Importa un CSV del SII para comenzar</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="font-medium text-gray-900">Períodos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Período</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">Compras</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">Ventas</th>
                    <th className="text-right px-3 py-3 font-medium text-gray-500">Neto Compras</th>
                    <th className="text-right px-3 py-3 font-medium text-gray-500">IVA Crédito</th>
                    <th className="text-right px-3 py-3 font-medium text-gray-500">Neto Ventas</th>
                    <th className="text-right px-3 py-3 font-medium text-gray-500">IVA Débito</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">Clasificación</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-500">Estado</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {periodos.map((p) => {
                    const r = resumenPeriodos[p.id] || {}
                    const cfg = estadoConfig[p.estado] || estadoConfig.borrador
                    const completo = r.total_compras > 0 && r.sin_clasificar === 0
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition">
                        <td
                          className="px-6 py-4 font-medium text-blue-600 cursor-pointer hover:text-blue-800"
                          onClick={() => router.push('/clientes/' + params.id + '/periodos/' + p.id + '/resumen')}
                        >
                          {meses[p.mes]} {p.anio}
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
                          <button
                            onClick={() => cambiarEstado(p.id, p.estado)}
                            className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.color} hover:opacity-80 transition`}
                          >
                            {cfg.label}
                          </button>
                        </td>
                        <td className="px-3 py-4 text-right">
                          <button
                            onClick={() => router.push('/clientes/' + params.id + '/periodos/' + p.id + '/f29')}
                            className="text-green-600 hover:text-green-800 text-xs font-medium mr-2"
                          >
                            F29
                          </button>
                          <button
                            onClick={() => router.push('/clientes/' + params.id + '/periodos/' + p.id + '/resumen')}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-2"
                          >
                            Resumen
                          </button>
                          <button
                            onClick={() => router.push('/clientes/' + params.id + '/periodos/' + p.id)}
                            className="text-gray-500 hover:text-gray-700 text-xs font-medium"
                          >
                            Facturas →
                          </button>
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
