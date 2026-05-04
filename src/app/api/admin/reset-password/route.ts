import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { usuario_id, password } = await req.json()

  if (!usuario_id || !password || password.length < 6) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(usuario_id, { password })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
