'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function EditarGastoPage() {
  const [gasto, setGasto] = useState<any>(null)
  const [categorias, setCategorias] = useState<any[]>([])
  const [proyectos, setProyectos] = useState<any[]>([])
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      const { data: gastoData } = await supabase
        .from('gastos_rendicion')
        .select('*, categorias_gasto(nombre, icono), proyectos(nombre)')
        .eq('id', params.gastoId).single()
      setGasto(gastoData)
      setForm({
        fecha: gastoData?.fecha || '',
        proveedor: gastoData?.proveedor || '',
        rut_proveedor: gastoData?.rut_proveedor || '',
        tipo_doc: gastoData?.tipo_doc || 'Boleta',
        folio: gastoData?.folio || '',
        concepto: gastoData?.concepto || '',
        categoria_id: gastoData?.categoria_id || '',
        proyecto_id: gastoData?.proyecto_id || '',
        medio_pago: gastoData?.medio_pago || 'Efectivo',
        neto: gastoData?.neto || 0,
        iva: gastoData?.iva || 0,
        total: gastoData?.total || 0,
        iva_recuperable: gastoData?.iva_recuperable || false,
        observaciones: gastoData?.observaciones || ''
      })

      if (gastoData?.imagen_url) {
        const { data } = await supabase.storage.from('comprobantes').createSignedUrl(gastoData.imagen_url, 300)
        if (data?.signedUrl) setFotoUrl(data.signedUrl)
      }

      const { data: categoriasData } = await supabase
        .from('categorias_gasto').select('*').eq('activo', true).order('nombre')
      setCategorias(categoriasData || [])

      const { data: proyectosData } = await supabase
        .from('proyectos').select('*').eq('activo', true).order('nombre')
      setProyectos(proyectosData || [])

      setLoading(false)
    }
    cargar()
  }, [])

  const guardar = async () => {
    setGuardando(true)
    const { error } = await supabase.from('gastos_rendicion').update({
      fecha: form.fecha,
      proveedor: form.proveedor,
      rut_proveedor: form.rut_proveedor,
      tipo_doc: form.tipo_doc,
      folio: form.folio,
      concepto: form.concepto,
      categoria_id: form.categoria_id || null,
      proyecto_id: form.proyecto_id || null,
      medio_pago: form.medio_pago,
      neto: parseFloat(form.neto) || 0,
      iva: parseFloat(form.iva) || 0,
      total: parseFloat(form.total) || 0,
      monto_solicitado: parseFloat(form.total) || 0,
      iva_recuperable: form.iva_recuperable,
      observaciones: form.observaciones
    }).eq('id', params.gastoId)

    if (error) {
      setMensaje('Error al guardar: ' + error.message)
    } else {
      setMensaje('Guardado correctamente')
      setTimeout(() => router.push('/rendiciones/' + params.id), 1000)
    }
    setGuardando(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/rendiciones/' + params.id)} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-lg font-bold text-gray-900">Editar comprobante</h1>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {fotoUrl && (
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Foto del comprobante</p>
            <img src={fotoUrl} alt="Comprobante" className="w-full rounded-xl max-h-64 object-contain" />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input type="date" value={form.fecha}
                onChange={e => setForm({ ...form, fecha: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo documento</label>
              <select value={form.tipo_doc} onChange={e => setForm({ ...form, tipo_doc: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Boleta</option>
                <option>Factura</option>
                <option>Ticket</option>
                <option>Sin documento</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor / Comercio</label>
            <input value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre del comercio" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RUT proveedor</label>
              <input value={form.rut_proveedor} onChange={e => setForm({ ...form, rut_proveedor: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="12345678-9" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Folio / N° documento</label>
              <input value={form.folio} onChange={e => setForm({ ...form, folio: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="12345" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">¿En qué se gastó? *</label>
            <input value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Almuerzo con cliente, pasaje metro, materiales..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria del gasto *</label>
            <select value={form.categoria_id} onChange={e => setForm({ ...form, categoria_id: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Seleccionar categoria...</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto o area</label>
            <select value={form.proyecto_id} onChange={e => setForm({ ...form, proyecto_id: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Sin proyecto</option>
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Medio de pago</label>
            <select value={form.medio_pago} onChange={e => setForm({ ...form, medio_pago: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Efectivo</option>
              <option>Tarjeta debito</option>
              <option>Tarjeta credito</option>
              <option>Transferencia</option>
              <option>Fondo fijo</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Neto</label>
              <input type="number" value={form.neto} onChange={e => setForm({ ...form, neto: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IVA</label>
              <input type="number" value={form.iva} onChange={e => setForm({ ...form, iva: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total *</label>
              <input type="number" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="iva_rec" checked={form.iva_recuperable}
              onChange={e => setForm({ ...form, iva_recuperable: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded" />
            <label htmlFor="iva_rec" className="text-sm text-gray-700">IVA recuperable (facturas de empresa)</label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2} placeholder="Cualquier detalle adicional..." />
          </div>

          {mensaje && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <p className="text-green-700 text-sm">{mensaje}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={guardar} disabled={guardando}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50">
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={() => router.push('/rendiciones/' + params.id)}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition">
              Cancelar
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
