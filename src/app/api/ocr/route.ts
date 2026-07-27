import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { base64, mediaType } = await req.json()

    // Si es PDF convertir a imagen usando la URL de datos
    const esPDF = mediaType === 'application/pdf'
    const urlDatos = `data:${mediaType};base64,${base64}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: urlDatos }
          },
          {
            type: 'text',
            text: 'Eres un experto en documentos tributarios chilenos. Analiza este comprobante y extrae TODOS los datos visibles.\n\nBusca:\n- Nombre del comercio o proveedor\n- RUT del emisor\n- Numero de folio o boleta\n- Fecha (formato YYYY-MM-DD)\n- Monto neto (sin IVA)\n- IVA\n- Monto total\n- Descripcion de lo comprado\n\nSi es boleta: neto = total / 1.19, iva = total - neto.\n\nResponde SOLO con JSON sin texto adicional:\n{"proveedor": "", "rut_proveedor": "", "tipo_doc": "Boleta", "folio": "", "fecha": "YYYY-MM-DD", "neto": 0, "iva": 0, "total": 0, "concepto": ""}'
          }
        ]
      }]
    })

    const content = response.choices[0].message.content || '{}'
    const clean = content.replace(/```json|```/g, '').trim()
    const datos = JSON.parse(clean)
    return NextResponse.json({ ok: true, datos })
  } catch (err: any) {
    console.error('OCR error:', err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
