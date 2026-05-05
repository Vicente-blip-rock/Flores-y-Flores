'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function CargaMasivaPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [archivos, setArchivos] = useState<any[]>([])
  const [procesando, setProcesando] = useState(false)
  const [resultados, setResultados] = useState<any[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase.from('clientes').select('*').eq('activo', true).order('nombre')
      setClientes(data || [])
    }
    cargar()
  }, [])

  const extraerRutDesdeNombre = (nombre: string) => {
    const match = nombre.match(/(\d{7,8}-[\dkK])/i)
    return match ? match[1] : null
  }

  const extraerMesAnioDesdeNombre = (nombre: string) => {
    const match = nombre.match(/(\d{4})(\d{2})/)
    if (match) return { anio: parseInt(match[1]), mes: parseInt(match[2]) }
    return null
  }

  const handleArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const lista = files.map(file => {
      const rut = extraerRutDesdeNombre(file.name)
      const mesAnio = extraerMesAnioDesdeNombre(file.name)
      const clienteMatch = rut ? clientes.find(c => c.rut.replace(/\./g, '') === rut.replace(/\./g, '')) : null
      const tipo = file.name.toLowerCase().includes('venta') ? 'ventas' : 'compras'

      return {
        file,
        nombre: file.name,
        rut,
        mesAnio,
        tipo,
        cliente: clienteMatch || null,
        cliente_id: clienteMatch?.id || null,
        estado: clienteMatch ? 'listo' : 'sin_cliente',
        mensaje: ''
      }
    })
    setArchivos(lista)
    setResultados([])
  }

  const asignarCliente = (idx: number, clienteId: string) => {
    const cliente = clientes.find(c => c.id === clienteId)
    setArchivos(prev => prev.map((a, i) =>
      i === idx ? { ...a, cliente_id: clienteId, cliente, estado: 'listo' } : a
    ))
  }

  const parsearNumero = (val: any) => {
    if (!val || val === '-' || val === '') return 0
    return parseFloat(String(val).replace(/\./g, '').replace(',', '.')) || 0
  }

  const parsearFecha = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0]
    const str = String(val).trim()
    if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.substring(0, 10)
    if (str.includes('/')) {
      const parts = str.split('/')
      if (parts.length === 3) return parts[2].substring(0,4) + '-' + parts[1].padStart(2,'0') + '-' + parts[0].padStart(2,'0')
    }
    return new Date().toISOString().split('T')[0]
  }

  const leerArchivo = (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          if (typeof data === 'string') {
            const lines = data.split('\n').filter(l => l.trim())
            const sep = lines[0].includes(';') ? ';' : ','
            resolve(lines.map(line => line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''))))
          } else {
            const workbook = XLSX.read(data, { type: 'binary' })
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            resolve(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][])
          }
        } catch (err) { reject(err) }
      }
      reader.onerror = reject
      if (file.name.endsWith('.csv')) reader.readAsText(file, 'UTF-8')
      else reader.readAsBinaryString(file)
    })
  }

  const procesarArchivo = async (archivo: any) => {
    const rows = await leerArchivo(archivo.file)
    const headerRow = rows.findIndex(r => r.some(c => String(c).toLowerCase().includes('nro')))
    const headers = (rows[headerRow] || []).map((h: any) => String(h).toLowerCase().trim())
    const col = (nombres: string[]) => {
      for (const n of nombres) {
        const idx = headers.findIndex(h => h.includes(n))
        if (idx !== -1) return idx
      }
      return -1
    }

    const mesAnio = archivo.mesAnio
    if (!mesAnio) return { ok: false, mensaje: 'No se pudo determinar el mes' }

    const { data: periodoExistente } = await supabase
      .from('periodos').select('id').eq('cliente_id', archivo.cliente_id)
      .eq('anio', mesAnio.anio).eq('mes', mesAnio.mes).maybeSingle()

    let periodoId = periodoExistente?.id
    if (!periodoId) {
      const { data: nuevoPeriodo } = await supabase
        .from('periodos').insert({ cliente_id: archivo.cliente_id, anio: mesAnio.anio, mes: mesAnio.mes, estado: 'borrador' })
        .select().single()
      periodoId = nuevoPeriodo?.id
    }

    const dataRows = rows.slice(headerRow + 1).filter(r => {
      const primera = String(r[0] || '').trim()
      return primera && !isNaN(parseInt(primera))
    })

    if (archivo.tipo === 'compras') {
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

      const facturas = dataRows.map((cols, idx) => ({
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
      }))

      await supabase.from('facturas').delete().eq('periodo_id', periodoId)
      const { error } = await supabase.from('facturas').insert(facturas)
      if (error) return { ok: false, mensaje: error.message }
      return { ok: true, mensaje: facturas.length + ' compras importadas' }
    } else {
      const rutCol = col(['rut cli', 'rut rec'])
      const razonCol = col(['razon social', 'razon'])
      const folioCol = col(['folio'])
      const fechaCol = col(['fecha docto', 'fecha '])
      const exentoCol = col(['monto exento', 'exento'])
      const netoCol = col(['monto neto', ' neto'])
      const ivaCol = col(['monto iva', ' iva '])
      const totalCol = col(['monto total', ' total'])

      const ventas = dataRows.map((cols, idx) => ({
        periodo_id: periodoId,
        numero_linea: idx + 1,
        tipo_doc: parseInt(String(cols[1])) || 33,
        tipo_venta: String(cols[2] || '').trim(),
        rut_cliente: String(cols[rutCol >= 0 ? rutCol : 3] || '').trim(),
        razon_social: String(cols[razonCol >= 0 ? razonCol : 4] || '').trim(),
        folio: String(cols[folioCol >= 0 ? folioCol : 5] || '').trim(),
        fecha: parsearFecha(cols[fechaCol >= 0 ? fechaCol : 6]),
        exento: parsearNumero(cols[exentoCol >= 0 ? exentoCol : 10]),
        neto: parsearNumero(cols[netoCol >= 0 ? netoCol : 11]),
        iva: parsearNumero(cols[ivaCol >= 0 ? ivaCol : 12]),
        total: parsearNumero(cols[totalCol >= 0 ? totalCol : 14]),
        iva_retenido_total: 0,
        iva_no_retenido: 0,
      }))

      await supabase.from('facturas_venta').delete().eq('periodo_id', periodoId)
      const { error } = await supabase.from('facturas_venta').insert(ventas)
      if (error) return { ok: false, mensaje: error.message }
      return { ok: true, mensaje: ventas.length + ' ventas importadas' }
    }
  }

  const procesarTodo = async () => {
    const listos = archivos.filter(a => a.estado === 'listo' && a.cliente_id && a.mesAnio)
    if (listos.length === 0) return
    setProcesando(true)
    const res = []
    for (const archivo of listos) {
      setArchivos(prev => prev.map(a => a.nombre === archivo.nombre ? { ...a, estado: 'procesando' } : a))
      try {
        const resultado = await procesarArchivo(archivo)
        setArchivos(prev => prev.map(a => a.nombre === archivo.nombre ? { ...a, estado: resultado.ok ? 'completado' : 'error', mensaje: resultado.mensaje } : a))
        res.push({ nombre: archivo.nombre, ...resultado })
      } catch (err: any) {
        setArchivos(prev => prev.map(a => a.nombre === archivo.nombre ? { ...a, estado: 'error', mensaje: err.message } : a))
      }
    }
    setResultados(res)
    setProcesando(false)
  }

  const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  const listos = archivos.filter(a => a.estado === 'listo').length
  const sinCliente = archivos.filter(a => a.estado === 'sin_cliente').length

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-900">Asesorias Flores y Flores</h1>
        <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 hover:text-gray-700">
          Volver
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Carga Masiva</h2>
          <p className="text-gray-500 text-sm mt-1">Sube multiples libros del SII de una vez — el sistema los asigna automaticamente por RUT</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-blue-400 transition">
            <span className="text-4xl mb-3">📂</span>
            <span className="text-gray-600 font-medium">Selecciona todos los archivos a cargar</span>
            <span className="text-gray-400 text-sm mt-1">CSV o Excel — puedes seleccionar multiples archivos</span>
            <input type="file" accept=".csv,.xlsx,.xls" multiple onChange={handleArchivos} className="hidden" />
          </label>
        </div>

        {archivos.length > 0 && (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-4">
                <span className="text-sm text-green-600 font-medium">✓ {listos} listos para importar</span>
                {sinCliente > 0 && <span className="text-sm text-yellow-600 font-medium">⚠ {sinCliente} sin cliente asignado</span>}
              </div>
              <button
                onClick={procesarTodo}
                disabled={procesando || listos === 0}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {procesando ? 'Importando...' : 'Importar todos (' + listos + ')'}
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Archivo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Periodo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {archivos.map((a, idx) => (
                    <tr key={idx} className={a.estado === 'error' ? 'bg-red-50' : a.estado === 'completado' ? 'bg-green-50' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-3 text-gray-700 text-xs">{a.nombre}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${a.tipo === 'compras' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {a.tipo === 'compras' ? 'Compras' : 'Ventas'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {a.mesAnio ? meses[a.mesAnio.mes] + ' ' + a.mesAnio.anio : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {a.estado === 'listo' || a.estado === 'procesando' || a.estado === 'completado' ? (
                          <span className="text-gray-700 text-xs">{a.cliente?.nombre}</span>
                        ) : (
                          <select
                            onChange={e => asignarCliente(idx, e.target.value)}
                            className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 w-full"
                            defaultValue=""
                          >
                            <option value="" disabled>Seleccionar cliente...</option>
                            {clientes.map(c => (
                              <option key={c.id} value={c.id}>{c.nombre} ({c.rut})</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.estado === 'listo' && <span className="text-green-600 text-xs font-medium">✓ Listo</span>}
                        {a.estado === 'sin_cliente' && <span className="text-yellow-600 text-xs font-medium">Sin cliente</span>}
                        {a.estado === 'procesando' && <span className="text-blue-600 text-xs font-medium">Procesando...</span>}
                        {a.estado === 'completado' && <span className="text-green-600 text-xs font-medium">✓ {a.mensaje}</span>}
                        {a.estado === 'error' && <span className="text-red-600 text-xs font-medium">Error: {a.mensaje}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
