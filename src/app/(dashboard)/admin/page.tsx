'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const [organizaciones, setOrganizaciones] = useState<any[]>([])
  const [planes, setPlanes] = useState<any[]>([])
  const [uso, setUso] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [showNuevaOrg, setShowNuevaOrg] = useState(false)
  const [form, setForm] = useState({ nombre: '', rut: '', email_contacto: '', telefono: '', plan_id: '' })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: sa } = await supabase
        .from('super_admins').select('id').eq('id', session.user.id).single()
      if (!sa) { router.push('/dashboard'); return }
      setIsSuperAdmin(true)

      const { data: planesData } = await supabase
        .from('planes').select('*').eq('activo', true).order('precio_mensual')
      setPlanes(planesData || [])

      const { data: orgsData } = await supabase
        .from('organizaciones')
        .select('*, planes(nombre, limite_documentos, precio_mensual)')
        .order('created_at', { ascending: false })
      setOrganizaciones(orgsData || [])

      const mesActual = new Date().getMonth() + 1
      const anioActual = new Date().getFullYear()
      const { data: usoData } = await supabase
        .from('uso_documentos')
        .select('organizacion_id, cantidad, tipo, created_at')
        .gte('created_at', `${anioActual}-${String(mesActual).padStart(2, '0')}-01`)
      setUso(usoData || [])

      setLoading(false)
    }
    cargar()
  }, [])

  const toggleActivo = async (orgId: string, activo: boolean) => {
    await supabase.from('organizaciones').update({ activo: !activo }).eq('id', orgId)
    setOrganizaciones(prev => prev.map(o => o.id === orgId ? { ...o, activo: !activo } : o))
  }

  const cambiarPlan = async (orgId: string, planId: string) => {
    await supabase.from('organizaciones').update({ plan_id: planId }).eq('id', orgId)
    const plan = planes.find(p => p.id === planId)
    setOrganizaciones(prev => prev.map(o => o.id === orgId ? { ...o, plan_id: planId, planes: plan } : o))
  }

  const crearOrganizacion = async () => {
    if (!form.nombre || !form.plan_id) { setMensaje('Nombre y plan son obligatorios'); return }
    setGuardando(true)
    const { error } = await supabase.from('organizaciones').insert({
      nombre: form.nombre, rut: form.rut,
      email_contacto: form.email_contacto, telefono: form.telefono,
      plan_id: form.plan_id, activo: true, documentos_mes_actual: 0,
      mes_contador: new Date().getMonth() + 1, anio_contador: new Date().getFullYear()
    })
    if (error) {
      setMensaje('Error al crear organizacion')
    } else {
      setMensaje('Organizacion creada exitosamente')
      setShowNuevaOrg(false)
      setForm({ nombre: '', rut: '', email_contacto: '', telefono: '', plan_id: '' })
      const { data: orgsData } = await supabase
        .from('organizaciones')
        .select('*, planes(nombre, limite_documentos, precio_mensual)')
        .order('created_at', { ascending: false })
      setOrganizaciones(orgsData || [])
    }
    setGuardando(false)
  }

  const formatNum = (n: number) =>
    n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })

  // METRICAS
  const orgsActivas = organizaciones.filter(o => o.activo)
  const orgsSuspendidas = organizaciones.filter(o => !o.activo)
  const mrr = orgsActivas.reduce((s, o) => s + (o.planes?.precio_mensual || 0), 0)
  const arr = mrr * 12
  const arpu = orgsActivas.length > 0 ? mrr / orgsActivas.length : 0
  const totalDocsmes = uso.reduce((s, u) => s + u.cantidad, 0)
  const docsConIA = uso.filter(u => u.tipo === 'compras').reduce((s, u) => s + u.cantidad, 0)
  const costoEstimadoOpenAI = docsConIA * 0.00005
  const orgsCercaLimite = organizaciones.filter(o => {
    const limite = o.planes?.limite_documentos || 999999
    return o.activo && o.documentos_mes_actual >= limite * 0.8
  })
  const orgsSinActividad = organizaciones.filter(o => {
    const usoOrg = uso.filter(u => u.organizacion_id === o.id)
    return o.activo && usoOrg.length === 0
  })

  const porPlan: Record<string, number> = {}
  orgsActivas.forEach(o => {
    const nombre = o.planes?.nombre || 'Sin plan'
    porPlan[nombre] = (porPlan[nombre] || 0) + 1
  })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  if (!isSuperAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg">Panel Super Admin</span>
          <span className="bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-0.5 rounded">ADMIN</span>
        </div>
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white text-sm">
          Ir al sistema →
        </button>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* INGRESOS */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Ingresos</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">MRR</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatNum(mrr)}</p>
              <p className="text-xs text-gray-400 mt-1">ingresos este mes</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">ARR</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{formatNum(arr)}</p>
              <p className="text-xs text-gray-400 mt-1">proyeccion anual</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">ARPU</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatNum(arpu)}</p>
              <p className="text-xs text-gray-400 mt-1">ingreso por org activa</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">Organizaciones activas</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{orgsActivas.length}</p>
              <p className="text-xs text-gray-400 mt-1">de {organizaciones.length} totales</p>
            </div>
          </div>
        </div>

        {/* USO */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Uso del sistema este mes</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">Docs procesados</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalDocsmes.toLocaleString('es-CL')}</p>
              <p className="text-xs text-gray-400 mt-1">compras + ventas</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">Docs clasificados con IA</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{docsConIA.toLocaleString('es-CL')}</p>
              <p className="text-xs text-gray-400 mt-1">libro de compras</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">Costo est. OpenAI</p>
              <p className="text-2xl font-bold text-orange-500 mt-1">${costoEstimadoOpenAI.toFixed(2)} USD</p>
              <p className="text-xs text-gray-400 mt-1">~$0.05 por 1000 docs</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-500">Orgs cerca del limite</p>
              <p className="text-2xl font-bold text-yellow-500 mt-1">{orgsCercaLimite.length}</p>
              <p className="text-xs text-gray-400 mt-1">mas del 80% usado</p>
            </div>
          </div>
        </div>

        {/* ALERTAS */}
        {(orgsCercaLimite.length > 0 || orgsSinActividad.length > 0 || orgsSuspendidas.length > 0) && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Alertas</h2>
            <div className="space-y-2">
              {orgsCercaLimite.map(o => (
                <div key={o.id} className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-yellow-800 font-medium text-sm">⚠️ {o.nombre} cerca del limite</p>
                    <p className="text-yellow-600 text-xs mt-0.5">
                      {o.documentos_mes_actual} / {o.planes?.limite_documentos?.toLocaleString()} docs usados ({Math.round(o.documentos_mes_actual / o.planes?.limite_documentos * 100)}%)
                    </p>
                  </div>
                  <select
                    value={o.plan_id || ''}
                    onChange={e => cambiarPlan(o.id, e.target.value)}
                    className="border border-yellow-300 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white"
                  >
                    {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              ))}
              {orgsSinActividad.map(o => (
                <div key={o.id} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-gray-700 font-medium text-sm">😴 {o.nombre} sin actividad este mes</p>
                  <p className="text-gray-500 text-xs mt-0.5">Riesgo de churn — considera contactarlos</p>
                </div>
              ))}
              {orgsSuspendidas.map(o => (
                <div key={o.id} className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-red-700 font-medium text-sm">🔴 {o.nombre} suspendida</p>
                    <p className="text-red-500 text-xs mt-0.5">No puede importar documentos</p>
                  </div>
                  <button
                    onClick={() => toggleActivo(o.id, false)}
                    className="text-xs font-medium text-green-600 hover:text-green-800"
                  >
                    Activar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DISTRIBUCION POR PLAN */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Distribucion por plan</h2>
          <div className="grid grid-cols-4 gap-4">
            {planes.map(p => (
              <div key={p.id} className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="font-bold text-gray-900">{p.nombre}</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{porPlan[p.nombre] || 0}</p>
                <p className="text-xs text-gray-500 mt-1">organizaciones</p>
                <p className="text-xs text-gray-400 mt-2">{formatNum(p.precio_mensual)}/mes</p>
              </div>
            ))}
          </div>
        </div>

        {/* ORGANIZACIONES */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Organizaciones</h2>
            <button
              onClick={() => setShowNuevaOrg(!showNuevaOrg)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              + Nueva organizacion
            </button>
          </div>

          {mensaje && <p className="text-sm mb-3 text-green-600 font-medium">{mensaje}</p>}

          {showNuevaOrg && (
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
              <h3 className="font-medium text-gray-900 mb-4">Nueva organizacion</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre del estudio o empresa" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RUT</label>
                  <input value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="12345678-9" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email contacto</label>
                  <input value={form.email_contacto} onChange={e => setForm({ ...form, email_contacto: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="contacto@empresa.cl" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
                  <select value={form.plan_id} onChange={e => setForm({ ...form, plan_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecciona un plan</option>
                    {planes.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} — {p.limite_documentos.toLocaleString()} docs/mes — {formatNum(p.precio_mensual)}/mes
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={crearOrganizacion} disabled={guardando}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Crear organizacion'}
                </button>
                <button onClick={() => setShowNuevaOrg(false)}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Organizacion</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Contacto</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Plan</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Uso mes</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">MRR</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {organizaciones.map((org) => {
                  const limite = org.planes?.limite_documentos || 999999
                  const pct = Math.round((org.documentos_mes_actual || 0) / limite * 100)
                  return (
                    <tr key={org.id} className={org.activo ? 'hover:bg-gray-50' : 'bg-red-50'}>
                      <td className="px-6 py-4">
                        <p className="font-medium text-blue-600 cursor-pointer hover:text-blue-800" onClick={() => router.push("/admin/organizaciones/" + org.id)}>{org.nombre}</p>
                        <p className="text-xs text-gray-400">{org.rut || '—'}</p>
                      </td>
                      <td className="px-4 py-4 text-gray-500 text-xs">{org.email_contacto || '—'}</td>
                      <td className="px-4 py-4">
                        <select
                          value={org.plan_id || ''}
                          onChange={e => cambiarPlan(org.id, e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700"
                        >
                          {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs font-medium ${pct >= 80 ? 'text-yellow-600' : 'text-gray-600'}`}>
                            {org.documentos_mes_actual || 0} / {limite === 999999 ? '∞' : limite.toLocaleString()}
                          </span>
                          {limite !== 999999 && (
                            <div className="w-20 bg-gray-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                                style={{ width: Math.min(pct, 100) + '%' }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-green-600">
                        {formatNum(org.planes?.precio_mensual || 0)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${org.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {org.activo ? 'Activa' : 'Suspendida'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => toggleActivo(org.id, org.activo)}
                          className={`text-xs font-medium ${org.activo ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}
                        >
                          {org.activo ? 'Suspender' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
