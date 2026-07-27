'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function NuevoAsientoPage() {
  const [cliente, setCliente] = useState<any>(null)
  const [periodos, setPeriodos] = useState<any[]>([])
  const [cuentas, setCuentas] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    periodo_id: '',
    fecha: new Date().toISOString().split('T')[0],
    glosa: '',
  })
  const [lineas, setLineas] = useState([
    { cuenta_nombre: '', debe: '', haber: '', glosa_linea: '' },
    { cuenta_nombre: '', debe: '', haber: '', glosa_linea: '' },
  ])
  const [busquedaActiva, setBusquedaActiva] = useState<number | null>(null)
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
        setForm(prev => ({ ...prev, periodo_id: periodosData[0].id }))
      }

      const { data: cuentasData } = await supabase
        .from('plan_base').select('nombre, codigo').eq('activo', true).order('nombre')
      setCuentas(cuentasData || [])
    }
    cargar()
  }, [])

  const agregarLinea = () => {
    setLineas([...lineas, { cuenta_nombre: '', debe: '', haber: '', glosa_linea: '' }])
  }

  const eliminarLinea = (idx: number) => {
    if (lineas.length <= 2) return
    setLineas(lineas.filter((_, i) => i !== idx))
  }

  const actualizarLinea = (idx: number, campo: string, valor: string) => {
    setLineas(lineas.map((l, i) => i === idx ? { ...l, [campo]: valor } : l))
  }

  const seleccionarCuenta = (idx: number, nombre: string) => {
    actualizarLinea(idx, 'cuenta_nombre', nombre)
    setBusquedaActiva(null)
    setBusqueda('')
  }

  const totalDebe = lineas.reduce((s, l) => s + (parseFloat(l.debe) || 0), 0)
  const totalHaber = lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0)
  const cuadra = Math.abs(totalDebe - totalHaber) < 1 && totalDebe > 0

  const cuentasFiltradas = cuentas.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.codigo && c.codigo.includes(busqueda))
  ).slice(0, 10)

  const guardar = async () => {
    if (!form.glosa) { setError('La glosa es obligatoria'); return }
    if (!cuadra) { setError('El asiento no cuadra — el debe debe ser igual al haber'); return }
    if (lineas.some(l => !l.cuenta_nombre)) { setError('Todas las líneas deben tener una cuenta'); return }

    setGuardando(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: usuarioData } = await supabase
      .from('usuarios').select('organizacion_id').eq('id', user?.id).single()

    const { data: numData } = await supabase.rpc('siguiente_numero_asiento', { p_cliente_id: params.id })

    const { data: asiento, error: asientoErr } = await supabase.from('asientos').insert({
      organizacion_id: usuarioData?.organizacion_id,
      cliente_id: params.id,
      periodo_id: form.periodo_id || null,
      numero: numData || 1,
      fecha: form.fecha,
      glosa: form.glosa,
      estado: 'borrador',
      origen: 'manual',
      total_debe: totalDebe,
      total_haber: totalHaber,
      cuadrado: cuadra
    }).select().single()

    if (asientoErr) {
      setError('Error al crear asiento: ' + asientoErr.message)
      setGuardando(false)
      return
    }

    const lineasInsert = lineas
      .filter(l => l.cuenta_nombre)
      .map((l, idx) => ({
        asiento_id: asiento.id,
        cuenta_nombre: l.cuenta_nombre,
        debe: parseFloat(l.debe) || 0,
        haber: parseFloat(l.haber) || 0,
        glosa_linea: l.glosa_linea,
        orden: idx + 1
      }))

    await supabase.from('lineas_asiento').insert(lineasInsert)
    router.push('/clientes/' + params.id + '/asientos')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/clientes/' + params.id + '/asientos')} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-lg font-bold text-gray-900">Nuevo Asiento Manual</h1>
          <span className="text-gray-400 text-sm">· {cliente?.nombre}</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* Cabecera del asiento */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <h3 className="font-medium text-gray-900 mb-4">Datos del asiento</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Periodo</label>
              <select value={form.periodo_id} onChange={e => setForm({ ...form, periodo_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Sin periodo</option>
                {periodos.map(p => (
                  <option key={p.id} value={p.id}>{meses[p.mes]} {p.anio}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input type="date" value={form.fecha}
                onChange={e => setForm({ ...form, fecha: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Glosa *</label>
              <input value={form.glosa} onChange={e => setForm({ ...form, glosa: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Pago factura proveedor..." />
            </div>
          </div>
        </div>

        {/* Líneas del asiento */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h3 className="font-medium text-gray-900">Líneas del asiento</h3>
            <div className={`text-sm font-medium px-3 py-1 rounded-full ${cuadra ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {cuadra ? '✓ Cuadra' : `Diferencia: ${formatNum(Math.abs(totalDebe - totalHaber))}`}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cuenta contable</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Glosa línea</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Debe</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Haber</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lineas.map((linea, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3 relative">
                    <input
                      value={linea.cuenta_nombre}
                      onChange={e => { actualizarLinea(idx, 'cuenta_nombre', e.target.value); setBusqueda(e.target.value); setBusquedaActiva(idx) }}
                      onFocus={() => { setBusquedaActiva(idx); setBusqueda(linea.cuenta_nombre) }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Buscar cuenta..." />
                    {busquedaActiva === idx && busqueda && cuentasFiltradas.length > 0 && (
                      <div className="absolute z-20 left-4 top-12 bg-white border border-gray-200 rounded-xl shadow-lg w-80 max-h-48 overflow-y-auto">
                        {cuentasFiltradas.map(c => (
                          <button key={c.nombre} onClick={() => seleccionarCuenta(idx, c.nombre)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700">
                            {c.codigo && <span className="text-gray-400 mr-2">{c.codigo}</span>}
                            {c.nombre}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input value={linea.glosa_linea}
                      onChange={e => actualizarLinea(idx, 'glosa_linea', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Descripcion..." />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={linea.debe}
                      onChange={e => actualizarLinea(idx, 'debe', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={linea.haber}
                      onChange={e => actualizarLinea(idx, 'haber', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0" />
                  </td>
                  <td className="px-3 py-3">
                    <button onClick={() => eliminarLinea(idx)}
                      className="text-red-400 hover:text-red-600 text-lg font-medium">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td className="px-4 py-3 font-bold text-gray-900" colSpan={2}>TOTALES</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">{formatNum(totalDebe)}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">{formatNum(totalHaber)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <div className="px-6 py-4 border-t">
            <button onClick={agregarLinea}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              + Agregar línea
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={guardar} disabled={guardando || !cuadra}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar asiento'}
          </button>
          <button onClick={() => router.push('/clientes/' + params.id + '/asientos')}
            className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition">
            Cancelar
          </button>
        </div>
      </main>
    </div>
  )
}
