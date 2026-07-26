import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { base64, mediaType } = await req.json()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 }
            },
            {
              type: 'text',
              text: 'Extrae los datos de este comprobante chileno (boleta, factura o ticket). Responde SOLO con JSON sin texto adicional ni backticks:\n{"proveedor": "", "rut_proveedor": "", "tipo_doc": "Boleta", "folio": "", "fecha": "YYYY-MM-DD", "neto": 0, "iva": 0, "total": 0, "concepto": ""}'
            }
          ]
        }]
      })
    })

    const data = await response.json()
    const content = data.content?.[0]?.text || '{}'
    const clean = content.replace(/```json|```/g, '').trim()
    const datos = JSON.parse(clean)
    return NextResponse.json({ ok: true, datos })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
