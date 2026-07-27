'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function ConciliacionPage() {
  const [cliente, setCliente] = useState<any>(null)
  const [periodos, setPeriodos] = useState<any[]>([])
  const [cartolas, setCartolas] = useState<any[]>([])
  const [cartolaActiva, setCartolaActiva] = useState<any>(null)
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [asientos, setAsientos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [conciliando, setConciliando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('')
  const [cuentaBancaria, setCuentaBancaria] = useState('')
  const [banco, setBanco] = useState('')
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  const formatNum = (n: number) =>
    (n || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })

  useEffect(() => {
    const cargar = async () => {
      const { data: clienteData } = await supabase
        .from('clientes').select('*').eq('id', params.id).single()
      setCliente(clienteData)

      const { data: periodosData } = await supabase
        .from('periodos').select('*').eq('cliente_id', params.id)
        .order('anio', { ascending: false }).order('mes', { ascending: false })
      setPeriodos(periodosData || [])
      if (periodosData && periodosData.length > 0) {
        setPeriodoSeleccionado(periodosData[0].id)
      }

      const { data: cartolasData } = await supabase
        .from('cartolas_bancarias').select('*').eq('cliente_id', params.id)
        .order('created_at', { ascending: false })
      setCartolas(cartolasData || [])

      setLoading(false)
    }
    cargar()
  }, [])

  const cargarMovimientos = async (cartolaId: string) => {
    const { data } = await supabase
      .from('movimientos_bancarios').select('*').eq('cartola_id', cartolaId).order('fecha')
    setMovimientos(data || [])
  }

  const cargarAsientos = async (periodoId: string) => {
    const { data } = await supabase
      .from('asientos').select('*, lineas_asiento(debe, haber)')
      .eq('periodo_id', periodoId).eq('estado', 'aprobado')
    setAsientos(data || [])
  }

  const detectarBanco = (texto: string): string => {
    const t = texto.toLowerCase()
    if (t.includes('bci')) return 'BCI'
    if (t.includes('estado')) return 'Banco Estado'
    if (t.includes('santander')) return 'Santander'
    if (t.includes('scotiabank') || t.includes('scotia')) return 'Scotiabank'
    if (t.includes('chile')) return 'Banco de Chile'
    if (t.includes('itau') || t.includes('itaú')) return 'Itaú'
    if (t.includes('falabella')) return 'Banco Falabella'
    if (t.includes('security')) return 'Banco Security'
    return 'Otro'
  }

  const parsearCartola = (rows: any[][]): any[] => {
    const movs: any[] = []
    let headerIdx = -1

    // Buscar header con fecha y monto
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].map(c => String(c || '').toLowerCase())
      if (row.some(c => c.includes('fecha')) && row.some(c => c.includes('monto') || c.includes('cargo') || c.includes('abono'))) {
        headerIdx = i
        break
      }
    }

    if (headerIdx === -1) return []

    const headers = rows[headerIdx].map(c => String(c || '').toLowerCase().trim())
    const fechaCol = headers.findIndex(h => h.includes('fecha'))
    const descCol = headers.findIndex(h => h.includes('descripcion') || h.includes('glosa') || h.includes('detalle'))
    const refCol = headers.findIndex(h => h.includes('ref') || h.includes('documento') || h.includes('num'))
    const cargoCol = headers.findIndex(h => h.includes('cargo') || h.includes('debito') || h.includes('egreso'))
    const abonoCol = headers.findIndex(h => h.includes('abono') || h.includes('credito') || h.includes('ingreso'))
    const montoCol = headers.findIndex(h => h.includes('monto') && !h.includes('cargo') && !h.includes('abono'))
    const saldoCol = headers.findIndex(h => h.includes('saldo'))

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[fechaCol]) continue

      const fechaRaw = String(row[fechaCol] || '').trim()
      if (!fechaRaw || fechaRaw === '') continue

      let fecha = ''
      if (fechaRaw.includes('/')) {
        const parts = fechaRaw.split('/')
        if (parts.length === 3) fecha = parts[2].substring(0,4) + '-' + parts[1].padStart(2,'0') + '-' + parts[0].padStart(2,'0')
      } else if (fechaRaw.match(/^\d{4}-\d{2}-\d{2}/)) {
        fecha = fechaRaw.substring(0, 10)
      } else {
        continue
      }

      const parseMonto = (v: any) => {
        if (!v && v !== 0) return 0
        const str = String(v).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
        return Math.abs(parseFloat(str) || 0)
      }

      let cargo = 0, abono = 0
      if (cargoCol >= 0) cargo = parseMonto(row[cargoCol])
      if (abonoCol >= 0) abono = parseMonto(row[abonoCol])
      if (montoCol >= 0 && cargo === 0 && abono === 0) {
        const m = parseMonto(row[montoCol])
        const rawStr = String(row[montoCol] || '')
        if (rawStr.includes('-')) cargo = m
        else abono = m
      }

      if (cargo === 0 && abono === 0) continue

      movs.push({
        fecha,
        descripcion: String(row[descCol] || '').trim(),
        referencia: refCol >= 0 ? String(row[refCol] || '').trim() : '',
        monto: cargo > 0 ? -cargo : abono,
        tipo: cargo > 0 ? 'cargo' : 'abono',
        saldo: saldoCol >= 0 ? parseMonto(row[saldoCol]) : null,
        estado_conciliacion: 'pendiente'
      })
    }
    return movs
  }

  const handleCartola = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !cuentaBancaria) {
      setMensaje('Completa el banco y número de cuenta antes de subir la cartola')
      return
    }

    setSubiendo(true)
    setMensaje('Procesando cartola...')

    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = ev.target?.result
        let rows: any[][]

        if (file.name.endsWith('.csv')) {
          const text = data as string
          const sep = text.includes(';') ? ';' : ','
          rows = text.split('\n').map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, '')))
        } else {
          const wb = XLSX.read(data, { type: 'binary' })
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false }) as any[][]
        }

        const movsParsed = parsearCartola(rows)
        if (movsParsed.length === 0) {
          setMensaje('No se pudieron detectar movimientos en el archivo')
          setSubiendo(false)
          return
        }

        const { data: { user } } = await supabase.auth.getUser()
        const { data: usuarioData } = await supabase.from('usuarios').select('organizacion_id').eq('id', user?.id).single()

        const fechas = movsParsed.map(m => m.fecha).sort()
        const { data: cartola } = await supabase.from('cartolas_bancarias').insert({
          organizacion_id: usuarioData?.organizacion_id,
          cliente_id: params.id,
          cuenta_bancaria: cuentaBancaria,
          banco,
          periodo_id: periodoSeleccionado || null,
          fecha_desde: fechas[0],
          fecha_hasta: fechas[fechas.length - 1],
          estado: 'pendiente'
        }).select().single()

        if (cartola) {
          const movsInsert = movsParsed.map(m => ({ ...m, cartola_id: cartola.id }))
          await supabase.from('movimientos_bancarios').insert(movsInsert)
          setCartolas(prev => [cartola, ...prev])
          setCartolaActiva(cartola)
          await cargarMovimientos(cartola.id)
          if (periodoSeleccionado) await cargarAsientos(periodoSeleccionado)
          setMensaje('✓ ' + movsParsed.length + ' movimientos importados correctamente')
        }
      } catch (err: any) {
        setMensaje('Error al procesar: ' + err.message)
      }
      setSubiendo(false)
    }

    if (file.name.endsWith('.csv')) reader.readAsText(file, 'UTF-8')
    else reader.readAsBinaryString(file)
  }

  const conciliarConIA = async () => {
    if (!cartolaActiva || movimientos.length === 0 || asientos.length === 0) return
    setConciliando(true)
    setMensaje('Conciliando con IA...')

    let conciliados = 0
    const movsPendientes = movimientos.filter(m => m.estado_conciliacion === 'pendiente')

    for (const mov of movsPendientes) {
      const monto = Math.abs(mov.monto)
      // Buscar asiento con monto similar (diferencia menor a $100)
      const asientoMatch = asientos.find(a => {
        const totalA = Math.abs(a.total_debe || 0)
        return Math.abs(totalA - monto) < 100
      })

      if (asientoMatch) {
        await supabase.from('movimientos_bancarios').update({
          estado_conciliacion: 'conciliado',
          asiento_id: asientoMatch.id
        }).eq('id', mov.id)
        conciliados++
      }
    }

    await cargarMovimientos(cartolaActiva.id)
    setMensaje('✓ IA concilió ' + conciliados + ' de ' + movsPendientes.length + ' movimientos')
    setConciliando(false)
  }

  const cambiarEstado = async (movId: string, estado: string) => {
    await supabase.from('movimientos_bancarios').update({ estado_conciliacion: estado }).eq('id', movId)
    setMovimientos(prev => prev.map(m => m.id === movId ? { ...m, estado_conciliacion: estado } : m))
  }

  const estadoConciliacion = {
    pendiente: { label: 'Pendiente', color: 'bg-gray-100 text-gray-600' },
    conciliado: { label: 'Conciliado', color: 'bg-green-100 text-green-700' },
    diferencia: { label: 'Diferencia', color: 'bg-red-100 text-red-700' },
    ignorado: { label: 'Ignorado', color: 'bg-gray-100 text-gray-400' },
  }

  const totalAbonos = movimientos.filter(m => m.tipo === 'abono').reduce((s, m) => s + Math.abs(m.monto), 0)
  const totalCargos = movimientos.filter(m => m.tipo === 'cargo').reduce((s, m) => s + Math.abs(m.monto), 0)
  const conciliados = movimientos.filter(m => m.estado_conciliacion === 'conciliado').length
  const pendientes = movimientos.filter(m => m.estado_conciliacion === 'pendiente').length

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/clientes/' + params.id)} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-lg font-bold text-gray-900">Conciliación Bancaria</h1>
          <span className="text-gray-400 text-sm">· {cliente?.nombre}</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Subir cartola */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h3 className="font-medium text-gray-900 mb-4">Subir cartola bancaria</h3>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
              <select value={banco} onChange={e => setBanco(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Seleccionar...</option>
                {['BCI', 'Banco Estado', 'Santander', 'Scotiabank', 'Banco de Chile', 'Itaú', 'Banco Falabella', 'Banco Security', 'Mercado Pago', 'Otro'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° Cuenta</label>
              <input value={cuentaBancaria} onChange={e => setCuentaBancaria(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="12345678" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Periodo</label>
              <select value={periodoSeleccionado} onChange={e => setPeriodoSeleccionado(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {periodos.map(p => (
                  <option key={p.id} value={p.id}>{meses[p.mes]} {p.anio}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Archivo</label>
              <label className="flex items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:border-blue-400 transition">
                <span className="text-sm text-gray-500">{subiendo ? 'Procesando...' : '📂 Subir cartola'}</span>
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleCartola} className="hidden" disabled={subiendo} />
              </label>
            </div>
          </div>
          {mensaje && <p className="text-sm text-blue-700">{mensaje}</p>}
        </div>

        <div className="grid grid-cols-4 gap-6">
          {/* Lista de cartolas */}
          <div className="col-span-1">
            <h3 className="font-medium text-gray-700 mb-3">Cartolas cargadas</h3>
            {cartolas.length === 0 ? (
              <div className="bg-white rounded-xl p-4 text-center">
                <p className="text-gray-400 text-sm">Sin cartolas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cartolas.map(c => (
                  <div key={c.id}
                    onClick={async () => { setCartolaActiva(c); await cargarMovimientos(c.id); if (c.periodo_id) await cargarAsientos(c.periodo_id) }}
                    className={'bg-white rounded-xl p-3 cursor-pointer border-2 transition ' + (cartolaActiva?.id === c.id ? 'border-blue-500' : 'border-transparent hover:border-gray-200')}>
                    <p className="font-medium text-gray-900 text-sm">{c.banco}</p>
                    <p className="text-xs text-gray-500">{c.cuenta_bancaria}</p>
                    <p className="text-xs text-gray-400 mt-1">{c.fecha_desde} → {c.fecha_hasta}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                      c.estado === 'conciliada' ? 'bg-green-100 text-green-700' :
                      c.estado === 'con_diferencias' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{c.estado}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Movimientos */}
          <div className="col-span-3">
            {!cartolaActiva ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <p className="text-gray-400">Selecciona una cartola para ver los movimientos</p>
              </div>
            ) : (
              <>
                {/* Métricas */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500">Total abonos</p>
                    <p className="text-lg font-bold text-green-600">{formatNum(totalAbonos)}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500">Total cargos</p>
                    <p className="text-lg font-bold text-red-500">{formatNum(totalCargos)}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500">Conciliados</p>
                    <p className="text-lg font-bold text-blue-600">{conciliados} / {movimientos.length}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500">Pendientes</p>
                    <p className={`text-lg font-bold ${pendientes > 0 ? 'text-orange-500' : 'text-green-600'}`}>{pendientes}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-gray-900">Movimientos ({movimientos.length})</h3>
                  <button onClick={conciliarConIA} disabled={conciliando || asientos.length === 0}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50">
                    {conciliando ? 'Conciliando...' : '⚡ Conciliar con IA'}
                  </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Descripcion</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500">Monto</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {movimientos.map(m => (
                        <tr key={m.id} className={m.estado_conciliacion === 'conciliado' ? 'bg-green-50' : m.estado_conciliacion === 'diferencia' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                          <td className="px-4 py-3 text-gray-600">{m.fecha}</td>
                          <td className="px-4 py-3">
                            <p className="text-gray-900 text-sm">{m.descripcion || '—'}</p>
                            {m.referencia && <p className="text-gray-400 text-xs">{m.referencia}</p>}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${m.tipo === 'abono' ? 'text-green-600' : 'text-red-500'}`}>
                            {m.tipo === 'abono' ? '+' : '-'}{formatNum(Math.abs(m.monto))}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoConciliacion[m.estado_conciliacion as keyof typeof estadoConciliacion]?.color}`}>
                              {estadoConciliacion[m.estado_conciliacion as keyof typeof estadoConciliacion]?.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {m.estado_conciliacion !== 'conciliado' && (
                                <button onClick={() => cambiarEstado(m.id, 'conciliado')}
                                  className="text-green-600 hover:text-green-800 text-xs font-medium">✓</button>
                              )}
                              {m.estado_conciliacion !== 'diferencia' && (
                                <button onClick={() => cambiarEstado(m.id, 'diferencia')}
                                  className="text-red-500 hover:text-red-700 text-xs font-medium">⚠</button>
                              )}
                              {m.estado_conciliacion !== 'ignorado' && (
                                <button onClick={() => cambiarEstado(m.id, 'ignorado')}
                                  className="text-gray-400 hover:text-gray-600 text-xs font-medium">—</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
