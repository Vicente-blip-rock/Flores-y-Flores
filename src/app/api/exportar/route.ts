import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const { facturas, cliente, periodo, meses } = await req.json()

  const workbook = XLSX.utils.book_new()

  // HOJA 1 - Libro clasificado
  const libroData = [
    ['Nro', 'Doc', 'RUT Proveedor', 'Razon Social', 'Folio', 'Fecha', 'Exento', 'Neto', 'IVA', 'Total', 'Cuenta']
  ]

  facturas.forEach((f: any, idx: number) => {
    libroData.push([
      idx + 1,
      f.tipo_doc,
      f.rut_proveedor,
      f.razon_social,
      f.folio,
      f.fecha,
      f.exento || 0,
      f.neto || 0,
      f.iva || 0,
      f.total || 0,
      f.tipo_compra || 'SIN CLASIFICAR',
    ])
  })

  libroData.push([
    '', '', '', 'TOTALES', '', '',
    facturas.reduce((s: number, f: any) => s + (f.exento || 0), 0),
    facturas.reduce((s: number, f: any) => s + (f.neto || 0), 0),
    facturas.reduce((s: number, f: any) => s + (f.iva || 0), 0),
    facturas.reduce((s: number, f: any) => s + (f.total || 0), 0),
    '',
  ])

  const sheet1 = XLSX.utils.aoa_to_sheet(libroData)
  sheet1['!cols'] = [
    { wch: 6 }, { wch: 6 }, { wch: 16 }, { wch: 35 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 30 }
  ]
  XLSX.utils.book_append_sheet(workbook, sheet1, 'Libro Clasificado')

  // HOJA 2 - Resumen por cuenta
  const resumen: Record<string, { exento: number, neto: number, iva: number, total: number, cantidad: number }> = {}
  facturas.forEach((f: any) => {
    const cuenta = f.tipo_compra || 'SIN CLASIFICAR'
    if (!resumen[cuenta]) resumen[cuenta] = { exento: 0, neto: 0, iva: 0, total: 0, cantidad: 0 }
    resumen[cuenta].exento += f.exento || 0
    resumen[cuenta].neto += f.neto || 0
    resumen[cuenta].iva += f.iva || 0
    resumen[cuenta].total += f.total || 0
    resumen[cuenta].cantidad += 1
  })

  const resumenData = [
    ['Cuenta', 'Facturas', 'Exento', 'Neto', 'IVA', 'Total']
  ]

  Object.entries(resumen)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([cuenta, datos]) => {
      resumenData.push([cuenta, datos.cantidad, datos.exento, datos.neto, datos.iva, datos.total])
    })

  resumenData.push([
    'TOTAL',
    facturas.length,
    facturas.reduce((s: number, f: any) => s + (f.exento || 0), 0),
    facturas.reduce((s: number, f: any) => s + (f.neto || 0), 0),
    facturas.reduce((s: number, f: any) => s + (f.iva || 0), 0),
    facturas.reduce((s: number, f: any) => s + (f.total || 0), 0),
  ])

  const sheet2 = XLSX.utils.aoa_to_sheet(resumenData)
  sheet2['!cols'] = [{ wch: 35 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(workbook, sheet2, 'Resumen por Cuenta')

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  const nombreMes = meses[periodo.mes] || 'Mes'
  const filename = (cliente.nombre || 'libro') + '_' + nombreMes + '_' + periodo.anio + '.xlsx'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="' + filename + '"',
    },
  })
}
