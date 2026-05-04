'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function OrgDetallePage() {
  const [org, setOrg] = useState<any>(null)
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuevoUsuario, setShowNuevoUsuario] = useState(false)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'admin' })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ nombre: '', rol: '' })
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const cargarDatos = async () => {
    const { data: orgData } = await supabase
      .from('organizaciones')
      .select('*, planes(nombre, limite_documentos, precio_mensual)')
      .eq('id', params.orgId).single()
    setOrg(orgData)

    const { data: usuariosData } = await supabase
      .from('usuarios').select('*').eq('organizacion_id', params.orgId).order('created_at')
    setUsuarios(usuariosData || [])

      .from('planes').select('*').eq('activo', true).order('precio_mensual')

    setLoading(false)
  }

  useEffect(() => {
    const verificar = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: sa } = await supabase
        .from('super_admins').select('id').eq('id', session.user.id).single()
      if (!sa) { router.push('/dashboard'); return }
      await cargarDatos()
    }
    verificar()
  }, [])

  const crearUsuario = async () => {
    if (!form.nombre || !form.email || !form.password) {
      setError('Todos los campos son obligatorios'); return
    }
    if (form.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres'); return
    }
    setGuardando(true)
    setError('')
    const res = await fetch('/api/admin/crear-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, organizacion_id: params.orgId })
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al crear usuario')
    } else {
      setMensaje('Usuario creado exitosamente')
      setShowNuevoUsuario(false)
      setForm({ nombre: '', email: '', password: '', rol: 'admin' })
      await cargarDatos()
    }
    setGuardando(false)
  }

  const iniciarEdicion = (u: any) => {
    setEditando(u.id)
    setEditForm({ nombre: u.nombre, rol: u.rol })
  }

  const guardarEdicion = async (usuarioId: string) => {
    await supabase.from('usuarios').update({
      nombre: editForm.nombre, rol: editForm.rol
    }).eq('id', usuarioId)
    setUsuarios(prev => prev.map(u =>
      u.id === usuarioId ? { ...u, nombre: editForm.nombre, rol: editForm.rol } : u
    ))
    setEditando(null)
    setMensaje('Usuario actualizado')
  }

  const toggleUsuario = async (usuarioId: string, activo: boolean) => {
    await supabase.from('usuarios').update({ activo: !activo }).eq('id', usuarioId)
    setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, activo: !activo } : u))
  }

  const resetPassword = async (usuarioId: string) => {
    const nuevaPassword = prompt('Ingresa la nueva contrasena (minimo 6 caracteres):')
    if (!nuevaPassword || nuevaPassword.length < 6) { alert('Contrasena invalida'); return }
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId, password: nuevaPassword })
    })
    if (res.ok) { setMensaje('Contrasena actualizada exitosamente') }
    else { setMensaje('Error al actualizar contrasena') }
  }

  const formatNum = (n: number) =>
    n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg">Panel Super Admin</span>
          <span className="bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-0.5 rounded">ADMIN</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/organizaciones/' + params.orgId + '/clientes')}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition"
          >
            Ver clientes
          </button>
          <button onClick={() => router.push('/admin')} className="text-gray-400 hover:text-white text-sm">
            ← Volver al panel
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{org?.nombre}</h2>
          <p className="text-gray-500 text-sm mt-1">
            {org?.rut && `RUT: ${org.rut} · `}
            Plan: {org?.planes?.nombre} · {formatNum(org?.planes?.precio_mensual || 0)}/mes
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Usuarios</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{usuarios.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Docs este mes</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{org?.documentos_mes_actual || 0}</p>
            <p className="text-xs text-gray-400 mt-1">de {org?.planes?.limite_documentos === 999999 ? '∞' : org?.planes?.limite_documentos?.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Estado</p>
            <p className={`text-2xl font-bold mt-1 ${org?.activo ? 'text-green-600' : 'text-red-500'}`}>
              {org?.activo ? 'Activa' : 'Suspendida'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h3 className="font-medium text-gray-900">Usuarios de la organizacion</h3>
            <button
              onClick={() => setShowNuevoUsuario(!showNuevoUsuario)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              + Nuevo usuario
            </button>
          </div>

          {mensaje && (
            <div className="px-6 py-3 bg-green-50 border-b border-green-100">
              <p className="text-sm text-green-700 font-medium">{mensaje}</p>
            </div>
          )}

          {showNuevoUsuario && (
            <div className="px-6 py-4 border-b bg-gray-50">
              <h4 className="font-medium text-gray-900 mb-4">Crear nuevo usuario</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="usuario@email.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena *</label>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Minimo 6 caracteres" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                  <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="admin">Admin</option>
                    <option value="asistente">Asistente</option>
                  </select>
                </div>
              </div>
              {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
              <div className="flex gap-3 mt-4">
                <button onClick={crearUsuario} disabled={guardando}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  {guardando ? 'Creando...' : 'Crear usuario'}
                </button>
                <button onClick={() => { setShowNuevoUsuario(false); setError('') }}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {usuarios.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400">No hay usuarios aun — crea el primero</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Nombre</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Email</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Rol</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map(u => (
                  <tr key={u.id} className={u.activo ? 'hover:bg-gray-50' : 'bg-red-50'}>
                    <td className="px-6 py-4">
                      {editando === u.id ? (
                        <input value={editForm.nombre}
                          onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
                          className="border border-blue-300 rounded-lg px-3 py-1 text-sm text-gray-900 w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      ) : (
                        <span className="font-medium text-gray-900">{u.nombre}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{u.email}</td>
                    <td className="px-4 py-4 text-center">
                      {editando === u.id ? (
                        <select value={editForm.rol}
                          onChange={e => setEditForm({ ...editForm, rol: e.target.value })}
                          className="border border-blue-300 rounded-lg px-2 py-1 text-xs text-gray-700">
                          <option value="admin">Admin</option>
                          <option value="asistente">Asistente</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.rol === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {u.rol === 'admin' ? 'Admin' : 'Asistente'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        {editando === u.id ? (
                          <>
                            <button onClick={() => guardarEdicion(u.id)}
                              className="text-xs font-medium text-green-600 hover:text-green-800">
                              Guardar
                            </button>
                            <button onClick={() => setEditando(null)}
                              className="text-xs font-medium text-gray-400 hover:text-gray-600">
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => iniciarEdicion(u)}
                              className="text-xs font-medium text-blue-600 hover:text-blue-800">
                              Editar
                            </button>
                            <button onClick={() => resetPassword(u.id)}
                              className="text-xs font-medium text-orange-500 hover:text-orange-700">
                              Reset pass
                            </button>
                            <button onClick={() => toggleUsuario(u.id, u.activo)}
                              className={`text-xs font-medium ${
                                u.activo ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'
                              }`}>
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
