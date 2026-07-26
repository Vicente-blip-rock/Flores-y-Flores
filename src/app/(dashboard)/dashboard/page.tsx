'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [usuario, setUsuario] = useState<any>(null)
  const [showMenu, setShowMenu] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: sa } = await supabase
        .from('super_admins').select('id').eq('id', session.user.id).maybeSingle()
      setIsSuperAdmin(!!sa)

      const { data: usuarioData } = await supabase
        .from('usuarios').select('*').eq('id', session.user.id).single()
      setUsuario(usuarioData)

      const { data } = await supabase.from('clientes').select('*').order('nombre')
      setClientes(data || [])
      setLoading(false)
    }
    checkSession()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getSaludo = () => {
    const hora = new Date().getHours()
    if (hora < 12) return 'Buenos días'
    if (hora < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }

  const clientesActivos = clientes.filter(c => c.activo).length

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F5F7' }}>
      <div style={{ color: '#6E6E73', fontSize: '15px', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
        Cargando...
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F7', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>

      {/* Navbar */}
      <nav style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.08)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '17px', fontWeight: 600, color: '#1D1D1F', letterSpacing: '-0.3px' }}>ContAI</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                style={{ fontSize: '13px', color: '#6E6E73', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onMouseOver={e => (e.currentTarget.style.background = '#F5F5F7')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                Herramientas
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                  <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {showMenu && (
                <div style={{
                  position: 'absolute', right: 0, top: '36px', background: '#fff',
                  borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                  padding: '6px', minWidth: '180px', zIndex: 100,
                  border: '1px solid rgba(0,0,0,0.08)'
                }}>
                  <button
                    onClick={() => { setShowMenu(false); router.push('/carga-masiva') }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '14px', color: '#1D1D1F', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#F5F5F7')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                    📂 Carga masiva
                  </button>
                  {isSuperAdmin && (
                    <button
                      onClick={() => { setShowMenu(false); router.push('/admin') }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '14px', color: '#1D1D1F', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px' }}
                      onMouseOver={e => (e.currentTarget.style.background = '#F5F5F7')}
                      onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                      ⚙️ Panel Admin
                    </button>
                  )}
                  <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />
                  <button
                    onClick={() => { setShowMenu(false); handleLogout() }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '14px', color: '#FF3B30', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#FFF5F5')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px' }}>

        {/* Saludo */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '34px', fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.5px', margin: 0 }}>
            {getSaludo()}{usuario?.nombre ? ', ' + usuario.nombre.split(' ')[0] : ''}.
          </h1>
          <p style={{ fontSize: '17px', color: '#6E6E73', marginTop: '6px', marginBottom: 0 }}>
            {clientes.length === 0 ? 'Agrega tu primer cliente para comenzar.' : `Tienes ${clientesActivos} cliente${clientesActivos !== 1 ? 's' : ''} activo${clientesActivos !== 1 ? 's' : ''}.`}
          </p>
        </div>

        {/* Acciones rápidas */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '40px', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/clientes/nuevo')}
            style={{ background: '#0071E3', color: '#fff', border: 'none', borderRadius: '980px', padding: '10px 20px', fontSize: '15px', fontWeight: 500, cursor: 'pointer', letterSpacing: '-0.2px' }}
            onMouseOver={e => (e.currentTarget.style.background = '#0077ED')}
            onMouseOut={e => (e.currentTarget.style.background = '#0071E3')}>
            + Nuevo cliente
          </button>

        </div>

        {/* Lista de clientes */}
        {clientes.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '18px', padding: '64px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏢</div>
            <p style={{ fontSize: '19px', fontWeight: 600, color: '#1D1D1F', margin: '0 0 8px' }}>Sin clientes aún</p>
            <p style={{ fontSize: '15px', color: '#6E6E73', margin: '0 0 24px' }}>Agrega tu primer cliente para comenzar a trabajar.</p>
            <button onClick={() => router.push('/clientes/nuevo')}
              style={{ background: '#0071E3', color: '#fff', border: 'none', borderRadius: '980px', padding: '12px 24px', fontSize: '15px', fontWeight: 500, cursor: 'pointer' }}>
              Agregar cliente
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1D1D1F', margin: 0, letterSpacing: '-0.3px' }}>Clientes</h2>
              <span style={{ fontSize: '13px', color: '#6E6E73' }}>{clientes.length} en total</span>
            </div>
            <div style={{ background: '#fff', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              {clientes.map((cliente, idx) => (
                <div
                  key={cliente.id}
                  style={{
                    padding: '16px 20px',
                    borderBottom: idx < clientes.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onClick={() => router.push('/clientes/' + cliente.id)}
                  onMouseOver={e => (e.currentTarget.style.background = '#F5F5F7')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: cliente.activo ? '#E8F4FE' : '#F5F5F7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '18px', flexShrink: 0
                    }}>
                      {cliente.tipo === 'empresa' ? '🏢' : '👤'}
                    </div>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: 500, color: '#1D1D1F', margin: 0, letterSpacing: '-0.2px' }}>{cliente.nombre}</p>
                      <p style={{ fontSize: '13px', color: '#6E6E73', margin: '2px 0 0' }}>
                        {cliente.rut}{cliente.rubro ? ' · ' + cliente.rubro : ''}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {!cliente.activo && (
                      <span style={{ fontSize: '12px', color: '#6E6E73', background: '#F5F5F7', padding: '3px 10px', borderRadius: '980px' }}>Inactivo</span>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => router.push('/clientes/' + cliente.id + '/editar')}
                        style={{ fontSize: '13px', color: '#0071E3', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}
                        onMouseOver={e => (e.currentTarget.style.background = '#E8F4FE')}
                        onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                        Editar
                      </button>
                    </div>
                    <svg width="7" height="12" viewBox="0 0 7 12" fill="none" style={{ color: '#C7C7CC' }}>
                      <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
