import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

export async function POST(req: NextRequest) {
  const { facturas, cliente, periodo, meses } = await req.json()

  const workbook = new ExcelJS.Workbook()

  // HOJA 1 - Libro clasificado
  const sheet1 = workbook.addWorksheet('Libro Clasificado')

  sheet1.columns = [
    { header: 'Nro', key: 'nro', width: 6 },
    { header: 'Doc', key: 'doc', width: 6 },
    { header: 'RUT Proveedor', key: 'rut', width: 16 },
    { header: 'Razon Social', key: 'razon', width: 35 },
    { header: 'Folio', key: 'folio', width: 12 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Exento', key: 'exento', width: 12 },
    { header: 'Neto', key: 'neto', width: 12 },
    { header: 'IVA', key: 'iva', width: 12 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Cuenta', key: 'cuenta', width: 30 },
  ]

  sheet1.getRow(1).font = { bold: true }
  sheet1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
  sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  facturas.forEach((f: any, idx: number) => {
    sheet1.addRow({
      nro: idx + 1,
      doc: f.tipo_doc,
      rut: f.rut_proveedor,
      razon: f.razon_social,
      folio: f.folio,
      fecha: f.fecha,
      exento: f.exento || 0,
      neto: f.neto || 0,
      iva: f.iva || 0,
      total: f.total || 0,
      cuenta: f.tipo_compra || 'SIN CLASIFICAR',
    })
  })

  // Fila de totales
  const totalRow = sheet1.addRow({
    nro: '',
    doc: '',
    rut: '',
    razon: 'TOTALES',
    folio: '',
    fecha: '',
    exento: facturas.reduce((s: number, f: any) => s + (f.exento || 0), 0),
    neto: facturas.reduce((s: number, f: any) => s + (f.neto || 0), 0),
    iva: facturas.reduce((s: number, f: any) => s + (f.iva || 0), 0),
    total: facturas.reduce((s: number, f: any) => s + (f.total || 0), 0),
    cuenta: '',
  })
  totalRow.font = { bold: true }
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }

  // Formato números
  ['exento', 'neto', 'iva', 'total'].forEach(col => {
    sheet1.getColumn(col).numFmt = '#,##0'
  })

  // HOJA 2 - Resumen por cuenta
  const sheet2 = workbook.addWorksheet('Resumen por Cuenta')

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

  sheet2.columns = [
    { header: 'Cuenta', key: 'cuenta', width: 35 },
    { header: 'Facturas', key: 'cantidad', width: 10 },
    { header: 'Exento', key: 'exento', width: 14 },
    { header: 'Neto', key: 'neto', width: 14 },
    { header: 'IVA', key: 'iva', width: 14 },
    { header: 'Total', key: 'total', width: 14 },
  ]

  sheet2.getRow(1).font = { bold: true }
  sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
  sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  Object.entries(resumen)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([cuenta, datos]) => {
      sheet2.addRow({ cuenta, ...datos })
    })

  const totalRow2 = sheet2.addRow({
    cuenta: 'TOTAL',
    cantidad: facturas.length,
    exento: facturas.reduce((s: number, f: any) => s + (f.exento || 0), 0),
    neto: facturas.reduce((s: number, f: any) => s + (f.neto || 0), 0),
    iva: facturas.reduce((s: number, f: any) => s + (f.iva || 0), 0),
    total: facturas.reduce((s: number, f: any) => s + (f.total || 0), 0),
  })
  totalRow2.font = { bold: true }
  totalRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }

  ;['exento', 'neto', 'iva', 'total'].forEach(col => {
    sheet2.getColumn(col).numFmt = '#,##0'
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const nombreMes = meses[periodo.mes] || 'Mes'
  const filename = `${cliente.nombre}_${nombreMes}_${periodo.anio}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
