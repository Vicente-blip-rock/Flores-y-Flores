'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function AsientosPage() {
  const [cliente, setCliente] = useState<any>(null)
  const [periodos, setPeriodos] = useState<any[]>([])
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<string>('')
  const [asientos, setAsientos] = useState<any[]>([])
  const [vista, setVista] = useState<'diario' | 'mayor' | 'balanza'>('diario')
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

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
        await cargarAsientos(periodosData[0].id)
      }
      setLoading(false)
    }
    cargar()
  }, [])

  const cargarAsientos = async (periodoId: string) => {
    let query = supabase
      .from('asientos')
      .select('*, lineas_asiento(*, cuenta_nombre, cuenta_codigo, debe, haber)')
      .eq('cliente_id', params.id)
      .order('numero')
    
    if (periodoId !== 'todos') {
      query = query.eq('periodo_id', periodoId)
    }
    
    const { data } = await query
    setAsientos(data || [])
  }

  const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  const generarAsientosDesdeLibro = async () => {
    if (!periodoSeleccionado) return
    setGenerando(true)
    setMensaje('Generando asientos desde el libro del SII...')

    const { data: facturas } = await supabase
      .from('facturas').select('*').eq('periodo_id', periodoSeleccionado)

    if (!facturas || facturas.length === 0) {
      setMensaje('No hay facturas en este periodo')
      setGenerando(false)
      return
    }

    // Verificar si ya existen asientos SII para este periodo
    const { data: asientosExistentes } = await supabase
      .from('asientos')
      .select('id')
      .eq('periodo_id', periodoSeleccionado)
      .eq('origen', 'sii')
      .limit(1)

    if (asientosExistentes && asientosExistentes.length > 0) {
      if (!confirm('Ya existen asientos generados desde el SII para este periodo. ¿Deseas eliminarlos y regenerar?')) {
        setGenerando(false)
        return
      }
      // Eliminar asientos SII existentes
      const { data: asientosSII } = await supabase
        .from('asientos').select('id').eq('periodo_id', periodoSeleccionado).eq('origen', 'sii')
      if (asientosSII) {
        for (const a of asientosSII) {
          await supabase.from('lineas_asiento').delete().eq('asiento_id', a.id)
        }
        await supabase.from('asientos').delete().eq('periodo_id', periodoSeleccionado).eq('origen', 'sii')
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: usuarioData } = await supabase
      .from('usuarios').select('organizacion_id').eq('id', user?.id).single()

    let creados = 0
    for (const factura of facturas) {
      if (!factura.tipo_compra) continue

      const { data: numData } = await supabase.rpc('siguiente_numero_asiento', { p_cliente_id: params.id })
      const numero = numData || 1

      const neto = factura.neto || 0
      const iva = factura.iva || 0
      const exento = factura.exento || 0
      const total = factura.total || 0
      const totalDebe = neto + iva + exento

      const { data: asiento } = await supabase.from('asientos').insert({
        organizacion_id: usuarioData?.organizacion_id,
        cliente_id: params.id,
        periodo_id: periodoSeleccionado,
        numero,
        fecha: factura.fecha,
        glosa: factura.razon_social + ' - ' + (factura.tipo_compra || '') + ' Fol.' + factura.folio,
        estado: 'borrador',
        origen: 'sii',
        factura_id: factura.id,
        total_debe: totalDebe,
        total_haber: total,
        cuadrado: Math.abs(totalDebe - total) < 1
      }).select().single()

      if (asiento) {
        const lineas: any[] = []
        if (neto > 0) {
          lineas.push({
            asiento_id: asiento.id,
            cuenta_nombre: factura.tipo_compra || 'GASTO',
            debe: neto,
            haber: 0,
            glosa_linea: 'Neto ' + factura.razon_social,
            orden: 1
          })
        }
        if (iva > 0) {
          lineas.push({
            asiento_id: asiento.id,
            cuenta_nombre: 'IVA CREDITO FISCAL',
            debe: iva,
            haber: 0,
            glosa_linea: 'IVA credito fiscal',
            orden: 2
          })
        }
        if (exento > 0) {
          lineas.push({
            asiento_id: asiento.id,
            cuenta_nombre: (factura.tipo_compra || 'GASTO') + ' EXENTO',
            debe: exento,
            haber: 0,
            glosa_linea: 'Monto exento ' + factura.razon_social,
            orden: 3
          })
        }
        lineas.push({
          asiento_id: asiento.id,
          cuenta_nombre: factura.razon_social,
          debe: 0,
          haber: total,
          glosa_linea: 'Proveedor ' + factura.rut_proveedor,
          orden: 4
        })
        if (lineas.length > 1) {
          await supabase.from('lineas_asiento').insert(lineas)
          creados++
        }
      }
    }

    await cargarAsientos(periodoSeleccionado)
    setMensaje('✓ ' + creados + ' asientos generados correctamente')
    setGenerando(false)
  }

  const aprobarAsiento = async (asientoId: string) => {
    await supabase.from('asientos').update({ estado: 'aprobado' }).eq('id', asientoId)
    await cargarAsientos(periodoSeleccionado)
  }

  const anularAsiento = async (asientoId: string) => {
    if (!confirm('¿Anular este asiento?')) return
    await supabase.from('asientos').update({ estado: 'anulado' }).eq('id', asientoId)
    await cargarAsientos(periodoSeleccionado)
  }

  // LIBRO MAYOR - agrupar por cuenta
  const libroMayor = () => {
    const cuentas: Record<string, { debe: number, haber: number, movimientos: any[] }> = {}
    asientos.filter(a => a.estado !== 'anulado').forEach(a => {
      (a.lineas_asiento || []).forEach((l: any) => {
        if (!cuentas[l.cuenta_nombre]) cuentas[l.cuenta_nombre] = { debe: 0, haber: 0, movimientos: [] }
        cuentas[l.cuenta_nombre].debe += l.debe || 0
        cuentas[l.cuenta_nombre].haber += l.haber || 0
        cuentas[l.cuenta_nombre].movimientos.push({ ...l, asiento_numero: a.numero, fecha: a.fecha, glosa: a.glosa })
      })
    })
    return cuentas
  }

  // BALANZA DE COMPROBACION
  const balanza = () => {
    const mayor = libroMayor()
    return Object.entries(mayor).map(([cuenta, datos]) => ({
      cuenta,
      debe: datos.debe,
      haber: datos.haber,
      saldo_deudor: datos.debe > datos.haber ? datos.debe - datos.haber : 0,
      saldo_acreedor: datos.haber > datos.debe ? datos.haber - datos.debe : 0,
    })).sort((a, b) => a.cuenta.localeCompare(b.cuenta))
  }

  const totalDebe = asientos.filter(a => a.estado !== 'anulado').reduce((s, a) => s + (a.total_debe || 0), 0)
  const totalHaber = asientos.filter(a => a.estado !== 'anulado').reduce((s, a) => s + (a.total_haber || 0), 0)
  const cuadra = Math.abs(totalDebe - totalHaber) < 1

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
          <h1 className="text-lg font-bold text-gray-900">Asientos Contables</h1>
          <span className="text-gray-400 text-sm">· {cliente?.nombre}</span>
        </div>
        <div className="flex gap-2">
          <select
            value={periodoSeleccionado}
            onChange={async e => { setPeriodoSeleccionado(e.target.value); await cargarAsientos(e.target.value) }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos los periodos</option>
            {periodos.map(p => (
              <option key={p.id} value={p.id}>{meses[p.mes]} {p.anio}</option>
            ))}
          </select>
          <button
            onClick={generarAsientosDesdeLibro}
            disabled={generando}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50"
          >
            {generando ? 'Generando...' : '⚡ Generar desde SII'}
          </button>
          <button
            onClick={() => router.push('/clientes/' + params.id + '/asientos/nuevo')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + Manual
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {mensaje && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-blue-700 text-sm">{mensaje}</p>
          </div>
        )}

        {/* Resumen cuadratura */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Debe</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatNum(totalDebe)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Haber</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatNum(totalHaber)}</p>
          </div>
          <div className={`rounded-2xl p-5 shadow-sm ${cuadra ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-sm text-gray-500">Cuadratura</p>
            <p className={`text-xl font-bold mt-1 ${cuadra ? 'text-green-600' : 'text-red-600'}`}>
              {cuadra ? '✓ Cuadra' : '⚠ No cuadra'}
            </p>
            {!cuadra && (
              <p className="text-xs text-red-500 mt-1">Diferencia: {formatNum(Math.abs(totalDebe - totalHaber))}</p>
            )}
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex gap-1 mb-4 bg-gray-200 p-1 rounded-xl w-fit">
          {(['diario', 'mayor', 'balanza'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${vista === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              {v === 'diario' ? 'Libro Diario' : v === 'mayor' ? 'Libro Mayor' : 'Balanza'}
            </button>
          ))}
        </div>

        {/* LIBRO DIARIO */}
        {vista === 'diario' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {asientos.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-400">No hay asientos en este periodo</p>
                <p className="text-gray-400 text-sm mt-1">Genera automáticamente desde el libro del SII o crea uno manual</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">N°</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Glosa</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Debe</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Haber</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {asientos.map(a => (
                    <>
                      <tr key={a.id} className={`border-b ${a.estado === 'anulado' ? 'opacity-40' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{String(a.numero).padStart(4, '0')}</td>
                        <td className="px-4 py-3 text-gray-600">{a.fecha}</td>
                        <td className="px-4 py-3 text-gray-700">{a.glosa}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNum(a.total_debe)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatNum(a.total_haber)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            a.estado === 'aprobado' ? 'bg-green-100 text-green-700' :
                            a.estado === 'anulado' ? 'bg-gray-100 text-gray-500' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {a.estado === 'aprobado' ? 'Aprobado' : a.estado === 'anulado' ? 'Anulado' : 'Borrador'}
                          </span>
                          {!a.cuadrado && a.estado !== 'anulado' && (
                            <span className="ml-1 text-red-500 text-xs">⚠</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {a.estado === 'borrador' && (
                              <>
                                <button onClick={() => aprobarAsiento(a.id)}
                                  className="text-green-600 hover:text-green-800 text-xs font-medium">Aprobar</button>
                                <button onClick={() => router.push('/clientes/' + params.id + '/asientos/' + a.id + '/editar')}
                                  className="text-blue-600 hover:text-blue-800 text-xs font-medium">Editar</button>
                                <button onClick={() => anularAsiento(a.id)}
                                  className="text-red-500 hover:text-red-700 text-xs font-medium">Anular</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {(a.lineas_asiento || []).map((l: any) => (
                        <tr key={l.id} className="bg-gray-50 border-b">
                          <td className="px-4 py-1.5"></td>
                          <td className="px-4 py-1.5"></td>
                          <td className="px-4 py-1.5 text-gray-500 text-xs pl-8">{l.cuenta_nombre}</td>
                          <td className="px-4 py-1.5 text-right text-gray-600 text-xs">{l.debe > 0 ? formatNum(l.debe) : ''}</td>
                          <td className="px-4 py-1.5 text-right text-gray-600 text-xs">{l.haber > 0 ? formatNum(l.haber) : ''}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* LIBRO MAYOR */}
        {vista === 'mayor' && (
          <div className="space-y-4">
            {Object.entries(libroMayor()).map(([cuenta, datos]) => (
              <div key={cuenta} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                  <h3 className="font-semibold text-gray-900">{cuenta}</h3>
                  <div className="flex gap-6 text-sm">
                    <span className="text-gray-500">Debe: <span className="font-medium text-gray-900">{formatNum(datos.debe)}</span></span>
                    <span className="text-gray-500">Haber: <span className="font-medium text-gray-900">{formatNum(datos.haber)}</span></span>
                    <span className="text-gray-500">Saldo: <span className={`font-medium ${datos.debe >= datos.haber ? 'text-blue-600' : 'text-green-600'}`}>
                      {formatNum(Math.abs(datos.debe - datos.haber))} {datos.debe >= datos.haber ? 'D' : 'H'}
                    </span></span>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left px-6 py-2 font-medium text-gray-500 text-xs">Asiento</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Fecha</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Glosa</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-500 text-xs">Debe</th>
                      <th className="text-right px-6 py-2 font-medium text-gray-500 text-xs">Haber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.movimientos.map((m: any, idx: number) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-6 py-2 text-gray-600">{String(m.asiento_numero).padStart(4, '0')}</td>
                        <td className="px-4 py-2 text-gray-600">{m.fecha}</td>
                        <td className="px-4 py-2 text-gray-700">{m.glosa}</td>
                        <td className="px-4 py-2 text-right text-gray-900">{m.debe > 0 ? formatNum(m.debe) : ''}</td>
                        <td className="px-6 py-2 text-right text-gray-900">{m.haber > 0 ? formatNum(m.haber) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* BALANZA DE COMPROBACION */}
        {vista === 'balanza' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Cuenta</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Debe</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Haber</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Saldo Deudor</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">Saldo Acreedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {balanza().map(b => (
                  <tr key={b.cuenta} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{b.cuenta}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatNum(b.debe)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatNum(b.haber)}</td>
                    <td className="px-4 py-3 text-right text-blue-600 font-medium">{b.saldo_deudor > 0 ? formatNum(b.saldo_deudor) : ''}</td>
                    <td className="px-6 py-3 text-right text-green-600 font-medium">{b.saldo_acreedor > 0 ? formatNum(b.saldo_acreedor) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                <tr>
                  <td className="px-6 py-3 font-bold text-gray-900">TOTALES</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatNum(balanza().reduce((s, b) => s + b.debe, 0))}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatNum(balanza().reduce((s, b) => s + b.haber, 0))}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-600">{formatNum(balanza().reduce((s, b) => s + b.saldo_deudor, 0))}</td>
                  <td className="px-6 py-3 text-right font-bold text-green-600">{formatNum(balanza().reduce((s, b) => s + b.saldo_acreedor, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
