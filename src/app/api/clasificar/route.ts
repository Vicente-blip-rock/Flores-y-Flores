import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const { facturas, plan_cuentas, cliente_id, organizacion_id, rubro } = await req.json()

  const historial = facturas.map((f: any) => {
    return '- ID: ' + f.id + ' | Proveedor: ' + f.razon_social + ' | RUT: ' + f.rut_proveedor + ' | Neto: ' + f.neto
  }).join('\n')

  const cuentas = plan_cuentas.join(', ')

  const contexto = rubro ? 'El cliente es una empresa del rubro: ' + rubro + '. Considera este rubro al clasificar cada factura.\n\n' : ''
  const prompt = 'Eres un asistente contable chileno experto en clasificacion de facturas.\n\n' + contexto +
    'Tu tarea es clasificar cada factura en una de las siguientes cuentas contables:\n' +
    cuentas + '\n\n' +
    'Facturas a clasificar:\n' +
    historial + '\n\n' +
    'Reglas:\n' +
    '- Clasifica segun el nombre del proveedor y el monto\n' +
    '- Empresas electricas (CGE, ENEL, CHILQUINTA, etc.) -> SERVICIOS BASICOS o ELECTRICIDAD\n' +
    '- Empresas de agua (ESSBIO, AGUAS, etc.) -> SERVICIOS BASICOS\n' +
    '- Empresas de telecomunicaciones (ENTEL, MOVISTAR, VTR, etc.) -> SERVICIOS BASICOS o GTO COMUNICACIONES\n' +
    '- Combustibles (COPEC, SHELL, PETROBRAS, ENEX, etc.) -> COMBUSTIBLES Y LUBRICANTES\n' +
    '- Bancos o financieras -> GTOS FINANCIEROS o GTOS BANCARIOS\n' +
    '- Supermercados (LIDER, JUMBO, UNIMARC, ALVI, etc.) -> segun contexto del cliente\n' +
    '- Si no puedes determinar con certeza -> GTOS GENERALES\n' +
    '- Usa SOLO las cuentas de la lista proporcionada\n\n' +
    'Responde SOLO con un JSON array con este formato exacto, sin texto adicional:\n' +
    '[{"id": "uuid", "tipo_compra": "CUENTA"}]'

  try {
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
