import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const body = await req.json()
    const { email, password, nombre, rol, organizacion_id } = body

    if (!email || !password || !nombre || !organizacion_id) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    const { error: usuarioError } = await supabaseAdmin.from('usuarios').insert({
      id: authData.user.id,
      email,
      nombre,
      rol: rol || 'admin',
      organizacion_id,
      activo: true
    })

    if (usuarioError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: usuarioError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, usuario_id: authData.user.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
