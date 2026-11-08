
import ExcelJS from 'exceljs'

export interface XlsxSheetInfo {
  id: number
  name: string
  rowCount: number
  columnCount: number
}

const MAX_SHEETS = 100
const MAX_COLUMNS = 100

function isKnownExcelJsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()

  return (
    message.includes('sheets') &&
    (
      message.includes('undefined') ||
      message.includes('cannot read') ||
      message.includes("can't access")
    )
  )
}

export async function readXlsxSheets(
  file: File
): Promise<XlsxSheetInfo[]> {
  const buffer = await file.arrayBuffer()
  const data = new Uint8Array(buffer)

  // Primeira tentativa: ExcelJS.
  try {
    const workbook = new ExcelJS.Workbook()

    await workbook.xlsx.load(data as never)

    return workbook.worksheets.map((sheet) => ({
      id: sheet.id,
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
    }))
  } catch (error) {
    // Não usar o leitor alternativo para qualquer erro.
    // Apenas para a incompatibilidade conhecida do ExcelJS.
    if (!isKnownExcelJsError(error)) {
      throw error
    }

    console.warn(
      'Excel2Bib: incompatibilidade do ExcelJS detectada. ' +
      'Tentando leitura alternativa com SheetJS.'
    )
  }

  // Segunda tentativa: SheetJS.
  // O App deve ter validado a estrutura e as fórmulas
  // do XLSX antes de chamar esta função.
  const XLSX = await import('xlsx')

  const workbook = XLSX.read(data, {
    type: 'array',
    cellFormula: true,
    bookVBA: true,
    cellDates: false,
    dense: false,
  })

  if (workbook.vbaraw) {
    throw new Error(
      'A planilha contém macros não permitidas.'
    )
  }

  if (workbook.SheetNames.length > MAX_SHEETS) {
    throw new Error(
      'O arquivo possui uma quantidade de abas não suportada.'
    )
  }

  return workbook.SheetNames.map((name, index) => {
    const worksheet = workbook.Sheets[name]

    if (!worksheet) {
      throw new Error(
        'Não foi possível interpretar uma das abas.'
      )
    }

    // Defesa adicional contra fórmulas no arquivo.
    for (const [address, cell] of Object.entries(worksheet)) {
      if (address.startsWith('!')) continue

      if (
        cell &&
        typeof cell === 'object' &&
        'f' in cell
      ) {
        throw new Error(
          'A planilha contém fórmulas não permitidas.'
        )
      }
    }

    const reference = worksheet['!ref']

    if (!reference) {
      return {
        id: index + 1,
        name,
        rowCount: 0,
        columnCount: 0,
      }
    }

    const range = XLSX.utils.decode_range(reference)

    const rowCount = range.e.r + 1
    const columnCount = range.e.c + 1

    if (columnCount > MAX_COLUMNS) {
      throw new Error(
        'A planilha possui mais de 100 colunas.'
      )
    }

    return {
      id: index + 1,
      name,
      rowCount,
      columnCount,
    }
  })
}
