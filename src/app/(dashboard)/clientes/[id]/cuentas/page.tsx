'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function CuentasClientePage() {
  const [cliente, setCliente] = useState<any>(null)
  const [planBase, setPlanBase] = useState<any[]>([])
  const [cuentasCliente, setCuentasCliente] = useState<any[]>([])
  const [seleccionadas, setSeleccionadas] = useState<Record<string, boolean>>({})
  const [busqueda, setBusqueda] = useState('')
  const [nuevaCuenta, setNuevaCuenta] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      const { data: clienteData } = await supabase
        .from('clientes').select('*').eq('id', params.id).single()
      setCliente(clienteData)

      const { data: baseData } = await supabase
        .from('plan_base').select('*').eq('activo', true).order('nombre')
      setPlanBase(baseData || [])

      const { data: clienteCuentas } = await supabase
        .from('plan_de_cuentas').select('*').eq('cliente_id', params.id).order('nombre')
      setCuentasCliente(clienteCuentas || [])

      const seleccion: Record<string, boolean> = {}
      if (clienteCuentas && clienteCuentas.length > 0) {
        clienteCuentas.forEach((c: any) => { seleccion[c.nombre] = c.activo })
      } else if (baseData) {
        baseData.forEach((c: any) => { seleccion[c.nombre] = true })
      }
      setSeleccionadas(seleccion)
      setLoading(false)
    }
    cargar()
  }, [])

  const toggleCuenta = (nombre: string) => {
    setSeleccionadas(prev => ({ ...prev, [nombre]: !prev[nombre] }))
  }

  const seleccionarTodas = () => {
    const todas: Record<string, boolean> = {}
    planBase.forEach(c => { todas[c.nombre] = true })
    cuentasCliente.filter(c => !planBase.find(b => b.nombre === c.nombre))
      .forEach(c => { todas[c.nombre] = true })
    setSeleccionadas(todas)
  }

  const deseleccionarTodas = () => {
    const ninguna: Record<string, boolean> = {}
    Object.keys(seleccionadas).forEach(k => { ninguna[k] = false })
    setSeleccionadas(ninguna)
  }

  const agregarCuenta = async () => {
    if (!nuevaCuenta.trim()) return
    const nombre = nuevaCuenta.trim().toUpperCase()
    setSeleccionadas(prev => ({ ...prev, [nombre]: true }))
    setNuevaCuenta('')
  }

  const guardar = async () => {
    setGuardando(true)
    setMensaje('')

    await supabase.from('plan_de_cuentas').delete().eq('cliente_id', params.id)

    const cuentasAGuardar = Object.entries(seleccionadas)
      .filter(([_, activo]) => activo)
      .map(([nombre]) => ({
        cliente_id: params.id,
        nombre,
        activo: true
      }))

    if (cuentasAGuardar.length > 0) {
      await supabase.from('plan_de_cuentas').insert(cuentasAGuardar)
    }

    setMensaje('Plan de cuentas guardado correctamente')
    setGuardando(false)
  }

  const todasLasCuentas = [
    ...planBase.map(c => c.nombre),
    ...cuentasCliente
      .filter(c => !planBase.find(b => b.nombre === c.nombre))
      .map(c => c.nombre)
  ].filter((v, i, a) => a.indexOf(v) === i).sort()

  const cuentasFiltradas = todasLasCuentas.filter(c =>
    c.toLowerCase().includes(busqueda.toLowerCase())
  )

  const totalSeleccionadas = Object.values(seleccionadas).filter(Boolean).length

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-900">Asesorias Flores y Flores</h1>
        <button onClick={() => router.push('/clientes/' + params.id)} className="text-sm text-gray-500 hover:text-gray-700">
          Volver
        </button>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Plan de Cuentas</h2>
            <p className="text-gray-500 text-sm mt-1">{cliente?.nombre} · {totalSeleccionadas} cuentas seleccionadas</p>
          </div>
          <button
            onClick={guardar}
            disabled={guardando}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar plan'}
          </button>
        </div>

        {mensaje && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6">
            <p className="text-green-700 text-sm font-medium">{mensaje}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="Buscar cuenta..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={seleccionarTodas} className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3">
              Todas
            </button>
            <button onClick={deseleccionarTodas} className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3">
              Ninguna
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
            {cuentasFiltradas.map(nombre => (
              <label key={nombre} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seleccionadas[nombre] || false}
                  onChange={() => toggleCuenta(nombre)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className={`text-sm ${seleccionadas[nombre] ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                  {nombre}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-medium text-gray-900 mb-3">Agregar cuenta personalizada</h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Nombre de la cuenta nueva..."
              value={nuevaCuenta}
              onChange={e => setNuevaCuenta(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregarCuenta()}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={agregarCuenta}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition"
            >
              + Agregar
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
