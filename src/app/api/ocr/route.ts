import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const PROMPT = 'Eres un experto en documentos tributarios chilenos. Analiza este comprobante y extrae TODOS los datos visibles.\n\nBusca:\n- Nombre del comercio o proveedor\n- RUT del emisor\n- Numero de folio o boleta\n- Fecha (formato YYYY-MM-DD)\n- Monto neto (sin IVA)\n- IVA\n- Monto total\n- Descripcion de lo comprado\n\nSi es boleta: neto = total / 1.19, iva = total - neto.\n\nResponde SOLO con JSON sin texto adicional:\n{"proveedor": "", "rut_proveedor": "", "tipo_doc": "Boleta", "folio": "", "fecha": "YYYY-MM-DD", "neto": 0, "iva": 0, "total": 0, "concepto": ""}'

export async function POST(req: NextRequest) {
  try {
    const { base64, mediaType } = await req.json()
    let content = '{}'

    console.log('OCR request - mediaType:', mediaType, 'base64 length:', base64?.length)
    if (mediaType === 'application/pdf') {
      console.log('Procesando PDF con Claude Haiku...')
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 }
              },
              { type: 'text', text: PROMPT }
            ]
          }]
        })
      })
      clearTimeout(timeout)
      const data = await response.json()
      console.log('Claude response status:', response.status, 'data:', JSON.stringify(data).substring(0, 200))
      content = data.content?.[0]?.text || '{}'
    } else {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mediaType};base64,${base64}` }
            },
            { type: 'text', text: PROMPT }
          ]
        }]
      })
      content = response.choices[0].message.content || '{}'
    }

    const datos = JSON.parse(content.replace(/```json|```/g, '').trim())
    return NextResponse.json({ ok: true, datos })
  } catch (err: any) {
    console.error('OCR error:', err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
