'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function ClientePage() {
  const [cliente, setCliente] = useState<any>(null)
  const [periodos, setPeriodos] = useState<any[]>([])
  const [resumenPeriodos, setResumenPeriodos] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [subiendoCompras, setSubiendoCompras] = useState(false)
  const [subiendoVentas, setSubiendoVentas] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [mensajeError, setMensajeError] = useState('')
  const [editandoPeriodo, setEditandoPeriodo] = useState<string | null>(null)
  const [periodoForm, setPeriodoForm] = useState({ mes: 1, anio: 2026 })
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

  const guardarPeriodo = async (periodoId: string) => {
    await supabase.from('periodos').update({ mes: periodoForm.mes, anio: periodoForm.anio }).eq('id', periodoId)
    setPeriodos(prev => prev.map(p => p.id === periodoId ? { ...p, mes: periodoForm.mes, anio: periodoForm.anio } : p))
    setEditandoPeriodo(null)
    await cargarDatos()
  }


  const cambiarEstado = async (periodoId: string, estadoActual: string) => {
    const siguiente: Record<string, string> = {
      'borrador': 'revision', 'revision': 'cerrado', 'cerrado': 'borrador'
    }
    const nuevoEstado = siguiente[estadoActual] || 'borrador'
    await supabase.from('periodos').update({ estado: nuevoEstado }).eq('id', periodoId)
    setPeriodos(prev => prev.map(p => p.id === periodoId ? { ...p, estado: nuevoEstado } : p))
  }

  const parsearNumero = (val: any) => {
    if (val === null || val === undefined || val === '-' || val === '') return 0
    const str = String(val).replace(/\./g, '').replace(',', '.')
    return parseFloat(str) || 0
  }

  const leerArchivo = (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          if (typeof data === 'string' && (data.includes(';') || file.name.endsWith('.csv'))) {
            const lines = data.split('\n').filter(l => l.trim())
            const sep = lines[0].includes(';') ? ';' : ','
            const rows = lines.map(line => line.split(sep).map(c => c.trim().replace(/^"|"$/g, '')))
            resolve(rows)
          } else {
            const workbook = XLSX.read(data, { type: 'binary' })
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][]
            resolve(rows)
          }
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = reject
      if (file.name.endsWith('.csv')) {
        reader.readAsText(file, 'UTF-8')
      } else {
        reader.readAsBinaryString(file)
      }
    })
  }

  const parsearFecha = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0]
    const str = String(val).trim()
    if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.substring(0, 10)
    if (str.includes('/')) {
      const parts = str.split('/')
      if (parts.length === 3) {
        const anio = parts[2].substring(0,4)
        return anio + '-' + parts[1].padStart(2,'0') + '-' + parts[0].padStart(2,'0')
      }
    }
    return new Date().toISOString().split('T')[0]
  }

  const procesarFilasCompras = (rows: any[][], periodoId: string) => {
    const headerRow = rows.findIndex(r => r.some(c => String(c).toLowerCase().includes('nro')))
    const headers = (rows[headerRow] || []).map((h: any) => String(h).toLowerCase().trim())

    const col = (nombres: string[]) => {
      for (const nombre of nombres) {
        const idx = headers.findIndex(h => h.includes(nombre))
        if (idx !== -1) return idx
      }
      return -1
    }

    const nroCol = col(['nro'])
    const docCol = col(['tipo doc', 'doc'])
    const rutCol = col(['rut prov', 'rut pro'])
    const razonCol = col(['razon social', 'razon'])
    const folioCol = col(['folio'])
    const fechaCol = col(['fecha docto', 'fecha '])
    const exentoCol = col(['monto exento', 'exento'])
    const netoCol = col(['monto neto', ' neto'])
    const ivaCol = col(['monto iva recuperable', 'iva recuperable', ' iva ', 'monto iva'])
    const ivaNoRecCol = col(['monto iva no recuperable', 'iva no recuperable'])
    const totalCol = col(['monto total', ' total'])

    const dataRows = rows.slice(headerRow + 1).filter(r => {
      const primera = String(r[nroCol >= 0 ? nroCol : 0] || '').trim()
      return primera && !isNaN(parseInt(primera)) && !primera.toLowerCase().includes('total')
    })

    return dataRows.map((cols, idx) => ({
      periodo_id: periodoId,
      numero_linea: parseInt(String(cols[nroCol >= 0 ? nroCol : 0])) || idx + 1,
      tipo_doc: parseInt(String(cols[docCol >= 0 ? docCol : 1])) || 33,
      rut_proveedor: String(cols[rutCol >= 0 ? rutCol : 2] || '').trim(),
      razon_social: String(cols[razonCol >= 0 ? razonCol : 3] || '').trim(),
      folio: String(cols[folioCol >= 0 ? folioCol : 4] || '').trim(),
      fecha: parsearFecha(cols[fechaCol >= 0 ? fechaCol : 5]),
      exento: parsearNumero(cols[exentoCol >= 0 ? exentoCol : 6]),
      neto: parsearNumero(cols[netoCol >= 0 ? netoCol : 7]),
      iva: parsearNumero(cols[ivaCol >= 0 ? ivaCol : 8]) + parsearNumero(cols[ivaNoRecCol >= 0 ? ivaNoRecCol : -1]),
      total: parsearNumero(cols[totalCol >= 0 ? totalCol : 9]),
      iepd: 0,
    })).map((f: any) => {
      if (f.tipo_doc === 61) {
        return {
          ...f,
          exento: f.exento > 0 ? -f.exento : f.exento,
          neto: f.neto > 0 ? -f.neto : f.neto,
          iva: f.iva > 0 ? -f.iva : f.iva,
          total: f.total > 0 ? -f.total : f.total,
        }
      }
      return f
    })
  }

  const procesarFilasVentas = (rows: any[][], periodoId: string) => {
    const headerRow = rows.findIndex(r => r.some(c => String(c).toLowerCase().includes('nro') || String(c).toLowerCase().includes('tipo')))
    const dataRows = rows.slice(headerRow + 1).filter(r => {
      const primera = String(r[0] || '').trim()
      return primera && !isNaN(parseInt(primera)) && !String(r[0]).toLowerCase().includes('total')
    })

    return dataRows.map((cols, idx) => ({
      periodo_id: periodoId,
      numero_linea: parseInt(String(cols[0])) || idx + 1,
      tipo_doc: parseInt(String(cols[1])) || 33,
      tipo_venta: String(cols[2] || '').trim(),
      rut_cliente: String(cols[3] || '').trim(),
      razon_social: String(cols[4] || '').trim(),
      folio: String(cols[5] || '').trim(),
      fecha: parsearFecha(cols[6]),
      exento: parsearNumero(cols[10]),
      neto: parsearNumero(cols[11]),
      iva: parsearNumero(cols[12]),
      total: parsearNumero(cols[13]),
      iva_retenido_total: parsearNumero(cols[14]),
      iva_no_retenido: parsearNumero(cols[16]),
    }))
  }

  const mesAnioDesdeNombre = (fileName: string) => {
    const match = fileName.match(/(\d{4})(\d{2})\./)
    if (match) return { anio: parseInt(match[1]), mes: parseInt(match[2]) }
    const match2 = fileName.match(/(\d{4})(\d{2})/)
    if (match2) return { anio: parseInt(match2[1]), mes: parseInt(match2[2]) }
    return null
  }

  const obtenerMesAnio = (rows: any[][], colFecha: number, fileName?: string) => {
    if (fileName) {
      const fromName = mesAnioDesdeNombre(fileName)
      if (fromName) return fromName
    }
    const headerRow = rows.findIndex(r =>
      r.some(c => String(c).toLowerCase().includes('nro'))
    )
    const headers = (rows[headerRow] || []).map((h: any) => String(h).toLowerCase().trim())
    let fechaColIdx = headers.findIndex(h => h.includes('fecha docto'))
    if (fechaColIdx === -1) fechaColIdx = headers.findIndex(h => h.includes('fecha'))
    if (fechaColIdx === -1) fechaColIdx = colFecha

    const dataRows = rows.slice(headerRow + 1).filter(r => {
      const primera = String(r[0] || '').trim()
      return primera && !isNaN(parseInt(primera))
    })
    if (dataRows.length === 0) return null

    for (let i = fechaColIdx; i < Math.min(fechaColIdx + 5, (dataRows[0] || []).length); i++) {
      const fechaStr = String(dataRows[0][i] || '').trim()
      if (fechaStr.includes('/')) {
        const parts = fechaStr.split('/')
        if (parts.length === 3 && parts[2].length >= 4) {
          return { mes: parseInt(parts[1]), anio: parseInt(parts[2].substring(0,4)) }
        }
      }
      if (fechaStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        const parts = fechaStr.split('-')
        return { mes: parseInt(parts[1]), anio: parseInt(parts[0]) }
      }
    }
    return null
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
    if (org.mes_contador !== mesActual || org.anio_contador !== anioActual) docsActuales = 0

    if (docsActuales + cantidad > limite) {
      return { ok: false, error: 'Limite de documentos alcanzado (' + docsActuales + '/' + limite + ')' }
    }

    await supabase.rpc('incrementar_documentos', { org_id: usuario.organizacion_id, cantidad })
    return { ok: true }
  }

  const handleCompras = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoCompras(true)
    setMensaje('')
    setMensajeError('')

    try {
      const rows = await leerArchivo(file)
      const headerRow = rows.findIndex(r => r.some(c => String(c).toLowerCase().includes('nro')))
      const mesAnio = obtenerMesAnio(rows.slice(headerRow + 1), 5, file.name)

      if (!mesAnio) {
        setMensajeError('No se pudo determinar el mes del archivo')
        setSubiendoCompras(false)
        return
      }

      const { mes, anio } = mesAnio

      const { data: periodoExistente } = await supabase
        .from('periodos').select('id').eq('cliente_id', params.id)
        .eq('anio', anio).eq('mes', mes).maybeSingle()

      let periodoId = periodoExistente?.id
      if (!periodoId) {
        const { data: nuevoPeriodo } = await supabase
          .from('periodos').insert({ cliente_id: params.id, anio, mes, estado: 'borrador' })
          .select().single()
        periodoId = nuevoPeriodo?.id
      }

      const facturas = procesarFilasCompras(rows, periodoId)

      if (facturas.length === 0) {
        setMensajeError('No se encontraron facturas en el archivo')
        setSubiendoCompras(false)
        return
      }

      const limite = await verificarLimite(facturas.length)
      if (!limite.ok) {
        setMensajeError(limite.error || 'Error de limite')
        setSubiendoCompras(false)
        return
      }

      await supabase.from('facturas').delete().eq('periodo_id', periodoId)
      const { error } = await supabase.from('facturas').insert(facturas)

      if (error) {
        setMensajeError('Error al guardar: ' + error.message)
      } else {
        setMensaje('✅ ' + facturas.length + ' compras importadas — ' + meses[mes] + ' ' + anio)
        await cargarDatos()
      }
    } catch (err: any) {
      setMensajeError('Error al leer el archivo: ' + err.message)
    }
    setSubiendoCompras(false)
  }

  const handleVentas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoVentas(true)
    setMensaje('')
    setMensajeError('')

    try {
      const rows = await leerArchivo(file)
      const headerRow = rows.findIndex(r => r.some(c => String(c).toLowerCase().includes('nro')))
      const mesAnio = obtenerMesAnio(rows.slice(headerRow + 1), 6, file.name)

      if (!mesAnio) {
        setMensajeError('No se pudo determinar el mes del archivo')
        setSubiendoVentas(false)
        return
      }

      const { mes, anio } = mesAnio

      const { data: periodoExistente } = await supabase
        .from('periodos').select('id').eq('cliente_id', params.id)
        .eq('anio', anio).eq('mes', mes).maybeSingle()

      let periodoId = periodoExistente?.id
      if (!periodoId) {
        const { data: nuevoPeriodo } = await supabase
          .from('periodos').insert({ cliente_id: params.id, anio, mes, estado: 'borrador' })
          .select().single()
        periodoId = nuevoPeriodo?.id
      }

      const ventas = procesarFilasVentas(rows, periodoId)

      if (ventas.length === 0) {
        setMensajeError('No se encontraron ventas en el archivo')
        setSubiendoVentas(false)
        return
      }

      const limite = await verificarLimite(ventas.length)
      if (!limite.ok) {
        setMensajeError(limite.error || 'Error de limite')
        setSubiendoVentas(false)
        return
      }

      await supabase.from('facturas_venta').delete().eq('periodo_id', periodoId)
      const { error } = await supabase.from('facturas_venta').insert(ventas)

      if (error) {
        setMensajeError('Error al guardar: ' + error.message)
      } else {
        setMensaje('✅ ' + ventas.length + ' ventas importadas — ' + meses[mes] + ' ' + anio)
        await cargarDatos()
      }
    } catch (err: any) {
      setMensajeError('Error al leer el archivo: ' + err.message)
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
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{cliente?.nombre}</h2>
            <p className="text-gray-500 text-sm">{cliente?.rut} · {cliente?.tipo === 'empresa' ? 'Empresa' : 'Persona Natural'}{cliente?.rubro ? ' · ' + cliente.rubro : ''}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/clientes/' + params.id + '/cuentas')}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            >
              Definir cuentas
            </button>
            <button
              onClick={() => router.push('/clientes/' + params.id + '/editar')}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            >
              Editar cliente
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="font-medium text-gray-900 mb-4">📥 Libro de Compras SII</h3>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-blue-400 transition">
              <span className="text-3xl mb-2">📂</span>
              <span className="text-gray-600 font-medium text-sm">Subir libro de compras</span>
              <span className="text-gray-400 text-xs mt-1">CSV o Excel (.csv, .xlsx, .xls)</span>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleCompras} className="hidden" />
            </label>
            {subiendoCompras && <p className="text-blue-600 text-sm mt-3 text-center">Procesando...</p>}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="font-medium text-gray-900 mb-4">📤 Libro de Ventas SII</h3>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-green-400 transition">
              <span className="text-3xl mb-2">📂</span>
              <span className="text-gray-600 font-medium text-sm">Subir libro de ventas</span>
              <span className="text-gray-400 text-xs mt-1">CSV o Excel (.csv, .xlsx, .xls)</span>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleVentas} className="hidden" />
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
            <p className="text-gray-400 text-lg">No hay periodos aun</p>
            <p className="text-gray-400 text-sm mt-1">Importa un archivo del SII para comenzar</p>
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
                        <td className="px-6 py-4 font-medium text-blue-600">
                          {editandoPeriodo === p.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={periodoForm.mes}
                                onChange={e => setPeriodoForm({ ...periodoForm, mes: parseInt(e.target.value) })}
                                className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-900"
                              >
                                {meses.slice(1).map((m, i) => (
                                  <option key={i+1} value={i+1}>{m}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                value={periodoForm.anio}
                                onChange={e => setPeriodoForm({ ...periodoForm, anio: parseInt(e.target.value) })}
                                className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 w-20"
                              />
                              <button onClick={() => guardarPeriodo(p.id)} className="text-green-600 text-xs font-medium">Guardar</button>
                              <button onClick={() => setEditandoPeriodo(null)} className="text-gray-400 text-xs">X</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="cursor-pointer hover:text-blue-800" onClick={() => router.push('/clientes/' + params.id + '/periodos/' + p.id + '/resumen')}>
                                {meses[p.mes]} {p.anio}
                              </span>
                              <button
                                onClick={() => { setEditandoPeriodo(p.id); setPeriodoForm({ mes: p.mes, anio: p.anio }) }}
                                className="text-gray-400 hover:text-gray-600 text-xs"
                              >
                                editar
                              </button>
                            </div>
                          )}
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
