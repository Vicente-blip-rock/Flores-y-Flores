import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: 'Bearer ' + token } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: usuario } = await supabase
    .from('usuarios').select('organizacion_id').eq('id', user.id).single()

  if (!usuario?.organizacion_id) {
    return NextResponse.json({ error: 'Usuario sin organizacion asignada' }, { status: 404 })
  }

  const { organizacion_id } = usuario
  const body = await req.json()
  const { facturas, tipo, periodo_id } = body

  const { data: org } = await supabase
    .from('organizaciones').select('activo').eq('id', organizacion_id).single()

  if (!org?.activo) {
    return NextResponse.json({ error: 'Organizacion suspendida. Contacta al administrador.' }, { status: 403 })
  }

  const { data: permitido } = await supabase
    .rpc('incrementar_documentos', { org_id: organizacion_id, cantidad: facturas.length })

  if (!permitido) {
    return NextResponse.json({
      error: 'Limite de documentos del plan alcanzado. Actualiza tu plan para continuar.'
    }, { status: 403 })
  }

  const tabla = tipo === 'ventas' ? 'facturas_venta' : 'facturas'
  await supabase.from(tabla).delete().eq('periodo_id', periodo_id)
  const { error } = await supabase.from(tabla).insert(facturas)

  if (error) {
    return NextResponse.json({ error: 'Error al guardar: ' + error.message }, { status: 500 })
  }

  await supabase.from('uso_documentos').insert({
    organizacion_id,
    periodo_id,
    cantidad: facturas.length,
    tipo
  })

  return NextResponse.json({ ok: true, cantidad: facturas.length })
}
