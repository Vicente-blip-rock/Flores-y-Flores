'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function RendicionPage() {
  const [rendicion, setRendicion] = useState<any>(null)
  const [gastos, setGastos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [proyectos, setProyectos] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuevoGasto, setShowNuevoGasto] = useState(false)
  const [procesandoIA, setProcesandoIA] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    proveedor: '',
    rut_proveedor: '',
    tipo_doc: 'Boleta',
    folio: '',
    concepto: '',
    categoria_id: '',
    proyecto_id: '',
    medio_pago: 'Efectivo',
    neto: '',
    iva: '',
    total: '',
    iva_recuperable: false,
    observaciones: ''
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const formatNum = (n: number) =>
    n?.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }) || '$0'

  const cargarDatos = async () => {
    const { data: rendicionData } = await supabase
      .from('rendiciones')
      .select('*, proyectos(nombre), rendidor:rendidor_id(nombre), aprobador:aprobador_id(nombre)')
      .eq('id', params.id).single()
    setRendicion(rendicionData)

    const { data: gastosData } = await supabase
      .from('gastos_rendicion')
      .select('*, categorias_gasto(nombre, icono), proyectos(nombre)')
      .eq('rendicion_id', params.id)
      .order('fecha')
    setGastos(gastosData || [])

    const { data: categoriasData } = await supabase
      .from('categorias_gasto').select('*').eq('activo', true).order('nombre')
    setCategorias(categoriasData || [])

    const { data: proyectosData } = await supabase
      .from('proyectos').select('*').eq('activo', true).order('nombre')
    setProyectos(proyectosData || [])

    const { data: usuariosData } = await supabase
      .from('usuarios').select('*').eq('activo', true).order('nombre')
    setUsuarios(usuariosData || [])

    setLoading(false)
  }

  useEffect(() => { cargarDatos() }, [])

  const comprimirImagen = (file: File): Promise<{ blob: Blob, base64: string, mediaType: string }> => {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const maxWidth = 1200
        const scale = img.width > maxWidth ? maxWidth / img.width : 1
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => {
          const reader = new FileReader()
          reader.onload = e => {
            const dataUrl = e.target?.result as string
            const base64 = dataUrl.split(',')[1]
            resolve({ blob: blob!, base64, mediaType: 'image/jpeg' })
          }
          reader.readAsDataURL(blob!)
        }, 'image/jpeg', 0.8)
        URL.revokeObjectURL(url)
      }
      img.src = url
    })
  }

  const subirFoto = async (blob: Blob, gastoId: string): Promise<string | null> => {
    const path = 'gastos/' + gastoId + '.jpg'
    const { error } = await supabase.storage.from('comprobantes').upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true
    })
    if (error) { console.error('Error subiendo foto:', error); return null }
    const { data } = supabase.storage.from('comprobantes').getPublicUrl(path)
    return path
  }

  const procesarImagenIA = async (file: File) => {
    setProcesandoIA(true)
    setMensaje('Procesando imagen con IA...')
    try {
      const { blob, base64, mediaType } = await comprimirImagen(file)
      
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType })
      })

      const data = await response.json()
      if (!data.ok) throw new Error(data.error)
      const datos = data.datos

      // Guardar blob para subir despues del gasto
      ;(window as any).__pendingBlob = blob

      setForm(prev => ({
        ...prev,
        proveedor: datos.proveedor || '',
        rut_proveedor: datos.rut_proveedor || '',
        tipo_doc: datos.tipo_doc || 'Boleta',
        folio: datos.folio || '',
        fecha: datos.fecha || prev.fecha,
        neto: datos.neto?.toString() || '',
        iva: datos.iva?.toString() || '',
        total: datos.total?.toString() || '',
        concepto: datos.concepto || '',
      }))
      setMensaje('Datos extraidos — revisa y confirma antes de guardar')
      setShowNuevoGasto(true)
      setProcesandoIA(false)
    } catch (err: any) {
      setMensaje('Error al procesar imagen: ' + err.message)
      setProcesandoIA(false)
    }
  }

  const handleImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) procesarImagenIA(file)
  }

  const agregarGasto = async () => {
    if (!form.total) { setMensaje('El monto total es obligatorio'); return }
    setGuardando(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: usuarioData } = await supabase
      .from('usuarios').select('organizacion_id').eq('id', user?.id).single()

    const total = parseFloat(form.total) || 0
    const neto = parseFloat(form.neto) || 0
    const iva = parseFloat(form.iva) || 0

    const { error } = await supabase.from('gastos_rendicion').insert({
      rendicion_id: params.id,
      organizacion_id: usuarioData?.organizacion_id,
      fecha: form.fecha,
      proveedor: form.proveedor,
      rut_proveedor: form.rut_proveedor,
      tipo_doc: form.tipo_doc,
      folio: form.folio,
      concepto: form.concepto,
      categoria_id: form.categoria_id || null,
      proyecto_id: form.proyecto_id || null,
      medio_pago: form.medio_pago,
      neto,
      iva,
      total,
      monto_solicitado: total,
      iva_recuperable: form.iva_recuperable,
      observaciones: form.observaciones,
      estado: 'borrador',
      procesado_por_ia: procesandoIA
    })

    if (!error) {
      // Subir foto si existe
      const pendingBlob = (window as any).__pendingBlob
      if (pendingBlob) {
        const { data: gastoCreado } = await supabase
          .from('gastos_rendicion').select('id').eq('rendicion_id', params.id)
          .order('created_at', { ascending: false }).limit(1).single()
        if (gastoCreado) {
          const fotoPath = await subirFoto(pendingBlob, gastoCreado.id)
          if (fotoPath) {
            await supabase.from('gastos_rendicion').update({ imagen_url: fotoPath }).eq('id', gastoCreado.id)
          }
        }
        delete (window as any).__pendingBlob
      }

      await supabase.from('rendiciones').update({
        total_solicitado: gastos.reduce((s, g) => s + (g.total || 0), 0) + total,
        updated_at: new Date().toISOString()
      }).eq('id', params.id)

      setForm({
        fecha: new Date().toISOString().split('T')[0],
        proveedor: '', rut_proveedor: '', tipo_doc: 'Boleta', folio: '',
        concepto: '', categoria_id: '', proyecto_id: '', medio_pago: 'Efectivo',
        neto: '', iva: '', total: '', iva_recuperable: false, observaciones: ''
      })
      setShowNuevoGasto(false)
      setMensaje('Gasto agregado correctamente')
      await cargarDatos()
    } else {
      setMensaje('Error al guardar: ' + error.message)
    }
    setGuardando(false)
  }

  const cambiarEstado = async (nuevoEstado: string) => {
    await supabase.from('rendiciones').update({ estado: nuevoEstado }).eq('id', params.id)
    await cargarDatos()
  }

  const eliminarGasto = async (gastoId: string, total: number) => {
    if (!confirm('Eliminar este gasto?')) return
    await supabase.from('gastos_rendicion').delete().eq('id', gastoId)
    await supabase.from('rendiciones').update({
      total_solicitado: Math.max(0, (rendicion?.total_solicitado || 0) - total)
    }).eq('id', params.id)
    await cargarDatos()
  }

  const estadoConfig: Record<string, { label: string, color: string, acciones: string[] }> = {
    borrador: { label: 'Borrador', color: 'bg-gray-100 text-gray-600', acciones: ['Enviar para aprobacion'] },
    enviada: { label: 'Enviada', color: 'bg-blue-100 text-blue-700', acciones: ['Aprobar', 'Rechazar'] },
    aprobada: { label: 'Aprobada', color: 'bg-green-100 text-green-700', acciones: ['Marcar como pagada'] },
    rechazada: { label: 'Rechazada', color: 'bg-red-100 text-red-700', acciones: ['Volver a borrador'] },
    pagada: { label: 'Pagada', color: 'bg-purple-100 text-purple-700', acciones: ['Cerrar'] },
    cerrada: { label: 'Cerrada', color: 'bg-gray-200 text-gray-500', acciones: [] },
  }

  const accionEstado: Record<string, string> = {
    'Enviar para aprobacion': 'enviada',
    'Aprobar': 'aprobada',
    'Rechazar': 'rechazada',
    'Marcar como pagada': 'pagada',
    'Volver a borrador': 'borrador',
    'Cerrar': 'cerrada',
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  const cfg = estadoConfig[rendicion?.estado] || estadoConfig.borrador
  const totalGastos = gastos.reduce((s, g) => s + (g.total || 0), 0)
  const editable = rendicion?.estado === 'borrador'

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-900">ContAI</h1>
        <button onClick={() => router.push('/rendiciones')} className="text-sm text-gray-500 hover:text-gray-700">
          ← Rendiciones
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900">{rendicion?.numero}</h2>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              Rendidor: {rendicion?.rendidor?.nombre} · 
              Proyecto: {rendicion?.proyectos?.nombre || 'Sin proyecto'}
            </p>
          </div>
          <div className="flex gap-2">
            {cfg.acciones.map(accion => (
              <button
                key={accion}
                onClick={() => cambiarEstado(accionEstado[accion])}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  accion === 'Aprobar' ? 'bg-green-600 text-white hover:bg-green-700' :
                  accion === 'Rechazar' ? 'bg-red-500 text-white hover:bg-red-600' :
                  'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {accion}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total gastos</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatNum(totalGastos)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total aprobado</p>
            <p className="text-xl font-bold text-green-600 mt-1">{formatNum(rendicion?.total_aprobado || 0)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">N° comprobantes</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{gastos.length}</p>
          </div>
        </div>

        {mensaje && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-blue-700 text-sm">{mensaje}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h3 className="font-medium text-gray-900">Comprobantes ({gastos.length})</h3>
            {editable && (
              <div className="flex gap-2">
                <label className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition cursor-pointer flex items-center gap-2">
                  {procesandoIA ? '⏳ Procesando...' : '📷 Subir foto'}
                  <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleImagen} className="hidden" />
                </label>
                <button
                  onClick={() => setShowNuevoGasto(!showNuevoGasto)}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  + Manual
                </button>
              </div>
            )}
          </div>

          {showNuevoGasto && (
            <div className="px-6 py-4 border-b bg-gray-50">
              <h4 className="font-medium text-gray-900 mb-4">Agregar comprobante</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha *</label>
                  <input type="date" value={form.fecha}
                    onChange={e => setForm({ ...form, fecha: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo doc</label>
                  <select value={form.tipo_doc} onChange={e => setForm({ ...form, tipo_doc: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Boleta</option>
                    <option>Factura</option>
                    <option>Ticket</option>
                    <option>Sin documento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Folio</label>
                  <input value={form.folio} onChange={e => setForm({ ...form, folio: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="N° documento" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Proveedor</label>
                  <input value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre del comercio" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">RUT proveedor</label>
                  <input value={form.rut_proveedor} onChange={e => setForm({ ...form, rut_proveedor: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="12345678-9" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Total *</label>
                  <input type="number" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Neto</label>
                  <input type="number" value={form.neto} onChange={e => setForm({ ...form, neto: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">IVA</label>
                  <input type="number" value={form.iva} onChange={e => setForm({ ...form, iva: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Categoria</label>
                  <select value={form.categoria_id} onChange={e => setForm({ ...form, categoria_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Sin categoria</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Concepto</label>
                  <input value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Descripcion del gasto" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Medio de pago</label>
                  <select value={form.medio_pago} onChange={e => setForm({ ...form, medio_pago: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Efectivo</option>
                    <option>Tarjeta debito</option>
                    <option>Tarjeta credito</option>
                    <option>Transferencia</option>
                    <option>Fondo fijo</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <input type="checkbox" id="iva_rec" checked={form.iva_recuperable}
                    onChange={e => setForm({ ...form, iva_recuperable: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded" />
                  <label htmlFor="iva_rec" className="text-xs text-gray-700">IVA recuperable</label>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={agregarGasto} disabled={guardando}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Agregar comprobante'}
                </button>
                <button onClick={() => setShowNuevoGasto(false)}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {gastos.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400">No hay comprobantes aun</p>
              <p className="text-gray-400 text-sm mt-1">Sube una foto o agrega manualmente</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Proveedor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Concepto</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Categoria</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Foto</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
                  {editable && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {gastos.map(g => (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-600">{g.fecha}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{g.proveedor || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{g.concepto || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {g.categorias_gasto ? g.categorias_gasto.icono + ' ' + g.categorias_gasto.nombre : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatNum(g.total)}</td>
                    <td className="px-4 py-3 text-center">
                      {g.imagen_url ? (
                        <button
                          onClick={async () => {
                            const { data } = await supabase.storage.from('comprobantes').createSignedUrl(g.imagen_url, 60)
                            if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                          }}
                          className="text-blue-600 hover:text-blue-800 text-lg"
                          title="Ver comprobante"
                        >
                          📄
                        </button>
                      ) : (
                        <span className="text-gray-300 text-lg">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        g.estado === 'aprobado' ? 'bg-green-100 text-green-700' :
                        g.estado === 'rechazado' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {g.estado}
                      </span>
                    </td>
                    {editable && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => eliminarGasto(g.id, g.total)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium">
                          Eliminar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-6 py-3 font-bold text-gray-900">TOTAL</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-600">{formatNum(totalGastos)}</td>
                  <td colSpan={editable ? 2 : 1}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
