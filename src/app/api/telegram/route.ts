import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const sendMessage = async (chatId: number, text: string) => {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  })
}

const getFile = async (fileId: string): Promise<string> => {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`)
  const data = await res.json()
  return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`
}

const downloadImage = async (url: string): Promise<string> => {
  const res = await fetch(url)
  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  return `data:${contentType};base64,${base64}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message = body.message
    if (!message) return NextResponse.json({ ok: true })

    const chatId = message.chat.id
    const telegramId = message.from.id
    const username = message.from.username || message.from.first_name || 'Usuario'
    const text = message.text || ''

    // Buscar usuario registrado
    const { data: telegramUser } = await supabase
      .from('telegram_usuarios')
      .select('*, clientes(nombre, rut, rubro)')
      .eq('telegram_id', telegramId)
      .single()

    // Comando /start
    if (text === '/start') {
      if (telegramUser?.estado === 'activo') {
        await sendMessage(chatId, `Hola ${username}! Ya estas registrado como cliente <b>${telegramUser.clientes?.nombre}</b>.\n\nEnviame una foto de una factura o boleta y la procesare automaticamente.`)
      } else {
        await sendMessage(chatId, `Hola ${username}! Bienvenido a IAconta.\n\nPara registrarte, enviame tu <b>RUT de empresa</b> (sin puntos, con guion).\nEjemplo: 76029106-4`)
      }
      return NextResponse.json({ ok: true })
    }

    // Si no esta registrado, espera el RUT
    if (!telegramUser || telegramUser.estado === 'pendiente') {
      const rutPattern = /^\d{7,8}-[\dkK]$/
      if (rutPattern.test(text.trim())) {
        const rut = text.trim()
        const { data: cliente } = await supabase
          .from('clientes')
          .select('id, nombre, organizacion_id')
          .eq('rut', rut)
          .single()

        if (!cliente) {
          await sendMessage(chatId, `No encontre ningun cliente con el RUT <b>${rut}</b>.\n\nVerifica el RUT e intentalo nuevamente.`)
          return NextResponse.json({ ok: true })
        }

        await supabase.from('telegram_usuarios').upsert({
          telegram_id: telegramId,
          telegram_username: username,
          cliente_id: cliente.id,
          organizacion_id: cliente.organizacion_id,
          estado: 'activo'
        }, { onConflict: 'telegram_id' })

        await sendMessage(chatId, `Perfecto! Quedaste registrado como <b>${cliente.nombre}</b>.\n\nAhora puedes enviarme fotos de tus facturas y boletas y las procesare automaticamente.`)
      } else {
        await sendMessage(chatId, `Por favor enviame tu RUT de empresa.\nFormato: 76029106-4`)
      }
      return NextResponse.json({ ok: true })
    }

    // Usuario registrado - procesar imagen
    if (message.photo || message.document) {
      await sendMessage(chatId, `Procesando tu documento... un momento`)

      let fileId = ''
      if (message.photo) {
        fileId = message.photo[message.photo.length - 1].file_id
      } else if (message.document) {
        fileId = message.document.file_id
      }

      const fileUrl = await getFile(fileId)
      const imageBase64 = await downloadImage(fileUrl)

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageBase64 }
            },
            {
              type: 'text',
              text: 'Extrae los datos de esta factura o boleta chilena. Responde SOLO con JSON sin texto adicional:\n{"rut_proveedor": "", "razon_social": "", "folio": "", "fecha": "YYYY-MM-DD", "neto": 0, "iva": 0, "total": 0, "tipo_doc": 33}'
            }
          ]
        }],
        max_tokens: 500
      })

      const content = response.choices[0].message.content || '{}'
      const clean = content.replace(/```json|```/g, '').trim()
      const datos = JSON.parse(clean)

      // Buscar o crear periodo actual
      const ahora = new Date()
      const mes = ahora.getMonth() + 1
      const anio = ahora.getFullYear()

      const { data: periodoExistente } = await supabase
        .from('periodos')
        .select('id')
        .eq('cliente_id', telegramUser.cliente_id)
        .eq('mes', mes)
        .eq('anio', anio)
        .maybeSingle()

      let periodoId = periodoExistente?.id
      if (!periodoId) {
        const { data: nuevoPeriodo } = await supabase
          .from('periodos')
          .insert({ cliente_id: telegramUser.cliente_id, mes, anio, estado: 'borrador' })
          .select().single()
        periodoId = nuevoPeriodo?.id
      }

      // Guardar factura
      await supabase.from('facturas').insert({
        periodo_id: periodoId,
        tipo_doc: datos.tipo_doc || 33,
        rut_proveedor: datos.rut_proveedor || '',
        razon_social: datos.razon_social || '',
        folio: datos.folio || '',
        fecha: datos.fecha || ahora.toISOString().split('T')[0],
        neto: datos.neto || 0,
        iva: datos.iva || 0,
        total: datos.total || 0,
        exento: 0,
        iepd: 0,
        clasificado_por: 'ia'
      })

      const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

      await sendMessage(chatId,
        `Factura registrada exitosamente!\n\n` +
        `Proveedor: <b>${datos.razon_social}</b>\n` +
        `RUT: ${datos.rut_proveedor}\n` +
        `Folio: ${datos.folio}\n` +
        `Total: $${(datos.total || 0).toLocaleString('es-CL')}\n` +
        `Periodo: ${meses[mes]} ${anio}`
      )

    } else if (text && text !== '/start') {
      await sendMessage(chatId, `Hola ${username}! Enviame una foto de una factura o boleta y la procesare automaticamente.`)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Telegram webhook error:', err)
    return NextResponse.json({ ok: true })
  }
}
