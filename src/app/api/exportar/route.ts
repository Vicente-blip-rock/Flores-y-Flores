import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const { facturas, ventas, cliente, periodo, meses } = await req.json()

  const workbook = XLSX.utils.book_new()

  // HOJA 1 - Libro clasificado
  const libroData: any[][] = [
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

  const resumenData: any[][] = [
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

  // HOJA 3 - Libro de ventas
  if (ventas && ventas.length > 0) {
    const ventasData: any[][] = [
      ['Nro', 'Doc', 'RUT Cliente', 'Razon Social', 'Folio', 'Fecha', 'Exento', 'Neto', 'IVA', 'Total']
    ]

    ventas.forEach((v: any, idx: number) => {
      ventasData.push([
        idx + 1,
        v.tipo_doc,
        v.rut_cliente,
        v.razon_social,
        v.folio,
        v.fecha,
        v.exento || 0,
        v.neto || 0,
        v.iva || 0,
        v.total || 0,
      ])
    })

    ventasData.push([
      '', '', '', 'TOTALES', '', '',
      ventas.reduce((s: number, v: any) => s + (v.exento || 0), 0),
      ventas.reduce((s: number, v: any) => s + (v.neto || 0), 0),
      ventas.reduce((s: number, v: any) => s + (v.iva || 0), 0),
      ventas.reduce((s: number, v: any) => s + (v.total || 0), 0),
    ])

    const sheet3 = XLSX.utils.aoa_to_sheet(ventasData)
    sheet3['!cols'] = [{ wch: 6 }, { wch: 6 }, { wch: 16 }, { wch: 35 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(workbook, sheet3, 'Libro Ventas')
  }

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
