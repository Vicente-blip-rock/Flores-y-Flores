import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    return NextResponse.json({ error: 'API key no encontrada' }, { status: 500 })
  }

  try {
    const openai = new OpenAI({ apiKey })
    const { facturas, plan_cuentas } = await req.json()

    const lista = facturas.map((f: any) =>
      '- ID: ' + f.id + ' | Proveedor: ' + f.razon_social + ' | RUT: ' + f.rut_proveedor + ' | Neto: ' + f.neto
    ).join('\n')

    const cuentas = plan_cuentas.join(', ')

    const prompt = 'Eres un asistente contable chileno experto en clasificacion de facturas.\n\nTu tarea es clasificar cada factura en una de las siguientes cuentas contables:\n' + cuentas + '\n\nFacturas a clasificar:\n' + lista + '\n\nReglas:\n- Clasifica segun el nombre del proveedor y el monto\n- Si el proveedor es una empresa de combustible (COPEC, SHELL, PETROBRAS, ENEX, etc.) usa COMBUSTIBLE\n- Si es una empresa electrica (CGE, ENEL, CHILQUINTA, etc.) usa GASTOS DE VENTA\n- Si es agua (ESSBIO, AGUAS, etc.) usa GASTOS DE VENTA\n- Si es un banco o financiera usa GASTOS FINANCIEROS\n- Si no puedes determinar con certeza usa GASTOS VARIOS\n- Usa SOLO las cuentas de la lista proporcionada\n\nResponde SOLO con un JSON array con este formato exacto, sin texto adicional:\n[{"id": "uuid", "tipo_compra": "CUENTA"}]'

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    })

    const content = response.choices[0].message.content || '[]'
    const clean = content.replace(/```json|```/g, '').trim()
    const clasificaciones = JSON.parse(clean)
    return NextResponse.json({ clasificaciones })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
