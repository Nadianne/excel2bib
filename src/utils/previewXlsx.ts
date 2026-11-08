
import ExcelJS from 'exceljs'

export interface XlsxPreview {
  sheetName: string
  headers: string[]
  rows: string[][]
}

const MAX_COLUMNS = 100

function cellToText(
  value: ExcelJS.CellValue
): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'object') {
    // Fórmulas não são permitidas.
    if ('formula' in value || 'sharedFormula' in value) {
      throw new Error(
        'Foi encontrada uma fórmula durante a pré-visualização.'
      )
    }

    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => part.text)
        .join('')
    }

    if ('text' in value && typeof value.text === 'string') {
      return value.text
    }

    if ('result' in value) {
      return value.result === undefined ||
        value.result === null
        ? ''
        : String(value.result)
    }

    return ''
  }

  return String(value)
}

export async function previewXlsx(
  file: File,
  sheetName: string
): Promise<XlsxPreview> {
  // Utiliza diretamente o ExcelJS.
  // Arquivos incompatíveis devem ser bloqueados na Etapa 1.
  const workbook = new ExcelJS.Workbook()
  const buffer = new Uint8Array(await file.arrayBuffer())

  await workbook.xlsx.load(buffer as never)

  const worksheet = workbook.getWorksheet(sheetName)

  if (!worksheet) {
    throw new Error(
      'A aba selecionada não foi encontrada.'
    )
  }

  if (worksheet.columnCount > MAX_COLUMNS) {
    throw new Error(
      'A planilha possui mais de 100 colunas.'
    )
  }

  const columnCount = worksheet.columnCount

  const readRow = (rowNumber: number): string[] => {
    const row = worksheet.getRow(rowNumber)

    return Array.from(
      { length: columnCount },
      (_, index) =>
        cellToText(
          row.getCell(index + 1).value
        )
    )
  }

  const headers = readRow(1)

  const rows: string[][] = []

  for (
    let rowNumber = 2;
    rowNumber <= worksheet.rowCount &&
    rows.length < 10;
    rowNumber++
  ) {
    const values = readRow(rowNumber)

    if (
      values.some(
        (value) => value.trim() !== ''
      )
    ) {
      rows.push(values)
    }
  }

  return {
    sheetName: worksheet.name,
    headers,
    rows,
  }
}
