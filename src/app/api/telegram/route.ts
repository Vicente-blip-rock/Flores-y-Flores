import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const sendMessage = async (chatId: number, text: string, keyboard?: any) => {
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' }
  if (keyboard) body.reply_markup = keyboard
  console.log('Sending message to', chatId, 'token exists:', !!process.env.TELEGRAM_BOT_TOKEN)
  const sendRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const sendData = await sendRes.json()
  console.log('Send result:', JSON.stringify(sendData).substring(0, 200))
}

const getFile = async (fileId: string): Promise<string> => {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`)
  const data = await res.json()
  return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`
}

const downloadImageBase64 = async (url: string): Promise<{ base64: string, mediaType: string }> => {
  const res = await fetch(url)
  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mediaType = 'image/jpeg'
  return { base64, mediaType }
}

const procesarOCR = async (base64: string, mediaType: string) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
        {
          type: 'text',
          text: 'Extrae datos de este comprobante chileno. Responde SOLO con JSON:\n{"proveedor": "", "rut_proveedor": "", "tipo_doc": "Boleta", "folio": "", "fecha": "YYYY-MM-DD", "neto": 0, "iva": 0, "total": 0, "concepto": ""}'
        }
      ]
    }]
  })
  const content = response.choices[0].message.content || '{}'
  return JSON.parse(content.replace(/```json|```/g, '').trim())
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('Telegram webhook received:', JSON.stringify(body).substring(0, 200))
    const message = body.message
    const callbackQuery = body.callback_query

    // Manejar callback de botones
    if (callbackQuery) {
      const chatId = callbackQuery.message.chat.id
      const telegramId = callbackQuery.from.id
      const data = callbackQuery.data

      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQuery.id })
      })

      const { data: tUser } = await supabase
        .from('telegram_usuarios').select('*').eq('telegram_id', telegramId).single()

      if (data === 'rendir') {
        await supabase.from('telegram_usuarios').update({ modo: 'rendir' }).eq('telegram_id', telegramId)
        await sendMessage(chatId, 'Perfecto! Envia la foto de tu boleta o ticket y la procesare automaticamente.')
      } else if (data === 'factura') {
        await supabase.from('telegram_usuarios').update({ modo: 'factura' }).eq('telegram_id', telegramId)
        await sendMessage(chatId, 'Envia la foto de la factura del cliente.')
      }
      return NextResponse.json({ ok: true })
    }

    if (!message) return NextResponse.json({ ok: true })

    const chatId = message.chat.id
    const telegramId = message.from.id
    const username = message.from.first_name || 'Usuario'
    const text = message.text || ''
    console.log('text:', JSON.stringify(text), 'has photo:', !!message.photo)

    const { data: telegramUser, error: tuError } = await supabase
      .from('telegram_usuarios').select('*, clientes(nombre, rut, rubro, organizacion_id)').eq('telegram_id', telegramId).maybeSingle()
    console.log('telegramUser:', JSON.stringify(telegramUser), 'error:', tuError?.message)

    // Comando /start
    if (text === '/start') {
      if (telegramUser?.estado === 'activo') {
        await sendMessage(chatId,
          'Hola ' + username + '! Soy IAconta.\n\nEstas registrado como usuario de <b>' + (telegramUser.clientes?.nombre || 'tu empresa') + '</b>.\n\nEnvíame una foto de tu boleta o factura y la proceso.',
          {
            inline_keyboard: [[
              { text: '💸 Rendir un gasto', callback_data: 'rendir' },
              { text: '🧾 Factura de cliente', callback_data: 'factura' }
            ]]
          }
        )
      } else {
        await sendMessage(chatId, 'Hola ' + username + '! Bienvenido a IAconta.\n\nPara registrarte, envíame el <b>RUT de tu empresa</b>.\nEjemplo: 76029106-4')
      }
      return NextResponse.json({ ok: true })
    }

    // Registro por RUT
    if (!telegramUser || telegramUser.estado === 'pendiente') {
      const rutClean = text.trim().replace(/\./g, '')
      const rutPattern = /^\d{7,8}-[\dkK]$/i
      if (rutPattern.test(rutClean)) {
        const rut = text.trim()
        const rutNormalizado = rut.replace(/\./g, '')
        const { data: cliente } = await supabase
          .from('clientes').select('id, nombre, organizacion_id')
          .or('rut.eq.' + rut + ',rut.eq.' + rutNormalizado)
          .limit(1)
          .maybeSingle()

        if (!cliente) {
          await sendMessage(chatId, 'No encontre ninguna empresa con el RUT <b>' + rut + '</b>.\n\nVerifica e intenta de nuevo.')
          return NextResponse.json({ ok: true })
        }

        await supabase.from('telegram_usuarios').upsert({
          telegram_id: telegramId,
          telegram_username: username,
          cliente_id: cliente.id,
          organizacion_id: cliente.organizacion_id,
          estado: 'activo',
          modo: 'rendir'
        }, { onConflict: 'telegram_id' })

        await sendMessage(chatId,
          'Listo! Quedaste registrado en <b>' + cliente.nombre + '</b>.\n\nAhora puedes enviarme fotos de tus gastos.',
          {
            inline_keyboard: [[
              { text: '💸 Rendir un gasto', callback_data: 'rendir' },
              { text: '🧾 Factura de cliente', callback_data: 'factura' }
            ]]
          }
        )
      } else {
        await sendMessage(chatId, 'Envíame tu RUT de empresa para registrarte.\nFormato: 76029106-4')
      }
      return NextResponse.json({ ok: true })
    }

    // Mensaje de texto de usuario registrado
    if (text && text !== '/start') {
      await sendMessage(chatId, 'Hola ' + username + '! Para procesar un documento, envíame una foto.',
        {
          inline_keyboard: [[
            { text: '💸 Rendir un gasto', callback_data: 'rendir' },
            { text: '🧾 Factura de cliente', callback_data: 'factura' }
          ]]
        }
      )
      return NextResponse.json({ ok: true })
    }

    // Procesar imagen
    if (message.photo || message.document) {
      await sendMessage(chatId, 'Procesando tu documento... un momento ⏳')

      let fileId = ''
      if (message.photo) {
        fileId = message.photo[message.photo.length - 1].file_id
      } else if (message.document) {
        fileId = message.document.file_id
      }

      const fileUrl = await getFile(fileId)
      const { base64, mediaType } = await downloadImageBase64(fileUrl)
      const datos = await procesarOCR(base64, mediaType)

      const modo = telegramUser.modo || 'rendir'
      const ahora = new Date()
      const mes = ahora.getMonth() + 1
      const anio = ahora.getFullYear()

      if (modo === 'rendir') {
        // Buscar o crear rendicion activa del usuario
        let { data: rendicion } = await supabase
          .from('rendiciones')
          .select('id')
          .eq('cliente_id', telegramUser.cliente_id)
          .eq('organizacion_id', telegramUser.organizacion_id)
          .eq('estado', 'borrador')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!rendicion) {
          const { count } = await supabase.from('rendiciones').select('*', { count: 'exact', head: true })
          const numero = 'R-' + anio + '-' + String((count || 0) + 1).padStart(3, '0')
          const { data: nueva, error: rendErr } = await supabase.from('rendiciones').insert({
            organizacion_id: telegramUser.organizacion_id,
            cliente_id: telegramUser.cliente_id,
            numero,
            estado: 'borrador',
            total_solicitado: 0,
            total_aprobado: 0
          }).select().single()
          console.log('Nueva rendicion:', nueva?.id, 'error:', rendErr?.message)
          rendicion = nueva
        }

        const total = datos.total || 0
        console.log('Guardando gasto en rendicion:', rendicion?.id, 'org:', telegramUser.organizacion_id)
        const { data: gastoCreado, error: gastoErr } = await supabase.from('gastos_rendicion').insert({
          rendicion_id: rendicion?.id,
          organizacion_id: telegramUser.organizacion_id,
          fecha: datos.fecha || ahora.toISOString().split('T')[0],
          proveedor: datos.proveedor || '',
          rut_proveedor: datos.rut_proveedor || '',
          tipo_doc: datos.tipo_doc || 'Boleta',
          folio: datos.folio || '',
          concepto: datos.concepto || '',
          neto: datos.neto || 0,
          iva: datos.iva || 0,
          total,
          monto_solicitado: total,
          estado: 'borrador',
          procesado_por_ia: true
        }).select().single()
        console.log('Gasto error:', gastoErr?.message)

        // Subir foto a Storage
        if (gastoCreado && !gastoErr) {
          try {
            const fotoPath = 'gastos/' + gastoCreado.id + '.jpg'
            const { error: storageErr } = await supabase.storage
              .from('comprobantes')
              .upload(fotoPath, Buffer.from(base64, 'base64'), {
                contentType: mediaType,
                upsert: true
              })
            if (!storageErr) {
              await supabase.from('gastos_rendicion').update({ imagen_url: fotoPath }).eq('id', gastoCreado.id)
              console.log('Foto subida:', fotoPath)
            } else {
              console.log('Error subiendo foto:', storageErr.message)
            }
          } catch (fotoErr: any) {
            console.log('Error foto:', fotoErr.message)
          }
        }

        await supabase.from('rendiciones').update({
          total_solicitado: supabase.rpc('incrementar_documentos', { org_id: telegramUser.organizacion_id, cantidad: 0 })
        }).eq('id', rendicion?.id)

        await sendMessage(chatId,
          'Gasto registrado!\n\n' +
          'Proveedor: <b>' + (datos.proveedor || 'No detectado') + '</b>\n' +
          'Total: <b>$' + total.toLocaleString('es-CL') + '</b>\n' +
          'Fecha: ' + (datos.fecha || 'No detectada') + '\n\n' +
          'Puedes ver y enviar tu rendicion desde ContAI.'
        )
      } else {
        // Modo factura - flujo contable
        const { data: periodoExistente } = await supabase
          .from('periodos').select('id').eq('cliente_id', telegramUser.cliente_id)
          .eq('mes', mes).eq('anio', anio).maybeSingle()

        let periodoId = periodoExistente?.id
        if (!periodoId) {
          const { data: nuevoPeriodo } = await supabase
            .from('periodos').insert({ cliente_id: telegramUser.cliente_id, mes, anio, estado: 'borrador' })
            .select().single()
          periodoId = nuevoPeriodo?.id
        }

        await supabase.from('facturas').insert({
          periodo_id: periodoId,
          tipo_doc: datos.tipo_doc === 'Factura' ? 33 : 39,
          rut_proveedor: datos.rut_proveedor || '',
          razon_social: datos.proveedor || '',
          folio: datos.folio || '',
          fecha: datos.fecha || ahora.toISOString().split('T')[0],
          neto: datos.neto || 0,
          iva: datos.iva || 0,
          total: datos.total || 0,
          exento: 0,
          iepd: 0,
          clasificado_por: 'ia'
        })

        await sendMessage(chatId,
          'Factura registrada!\n\n' +
          'Proveedor: <b>' + (datos.proveedor || 'No detectado') + '</b>\n' +
          'Total: <b>$' + (datos.total || 0).toLocaleString('es-CL') + '</b>\n\n' +
          'Periodo: ' + mes + '/' + anio
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Telegram error:', err)
    return NextResponse.json({ ok: true })
  }
}
