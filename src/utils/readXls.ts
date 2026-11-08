
import * as XLSX from 'xlsx'

const MAX_FILE_SIZE = 25 * 1024 * 1024
const MAX_RECORDS = 5000
const MAX_COLUMNS = 100
const MAX_SHEETS = 100

export interface XlsSheetInfo {
  id: number
  name: string
  rowCount: number
  columnCount: number
}

export interface XlsSheetData {
  sheetName: string
  headers: string[]
  rows: string[][]
}

export interface XlsReadResult {
  sheets: XlsSheetInfo[]
  data: XlsSheetData[]
}

function checkFormulaCells(
  sheet: XLSX.WorkSheet,
  sheetName: string
): void {
  for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith('!')) {
      continue
    }

    if (cell && typeof cell === 'object' && 'f' in cell) {
      throw new Error(
        `Foram identificadas fórmulas na aba "${sheetName}".`
      )
    }
  }
}

function checkFileSignature(bytes: Uint8Array): void {
  const signature = [
    0xd0, 0xcf, 0x11, 0xe0,
    0xa1, 0xb1, 0x1a, 0xe1,
  ]

  const matches = signature.every(
    (value, index) => bytes[index] === value
  )

  if (!matches) {
    throw new Error(
      'A assinatura do arquivo não corresponde ao formato XLS.'
    )
  }
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

export async function readXls(
  file: File
): Promise<XlsReadResult> {
  if (file.size === 0) {
    throw new Error('O arquivo XLS está vazio.')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('O arquivo XLS ultrapassa 25 MB.')
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  checkFileSignature(bytes)

  const workbook = XLSX.read(bytes, {
    type: 'array',
    cellFormula: true,
    bookVBA: true,
    cellDates: false,
    dense: false,
  })

  if (workbook.vbaraw) {
    throw new Error(
      'Arquivos contendo macros VBA não são permitidos.'
    )
  }

  if (
    workbook.SheetNames.length === 0 ||
    workbook.SheetNames.length > MAX_SHEETS
  ) {
    throw new Error(
      'O XLS possui uma quantidade de abas não suportada.'
    )
  }

  const sheets: XlsSheetInfo[] = []
  const data: XlsSheetData[] = []

  let totalRecords = 0

  for (
    let sheetIndex = 0;
    sheetIndex < workbook.SheetNames.length;
    sheetIndex++
  ) {
    const sheetName = workbook.SheetNames[sheetIndex]
    const sheet = workbook.Sheets[sheetName]

    if (!sheet) {
      throw new Error(
        `Não foi possível ler a aba "${sheetName}".`
      )
    }

    // Verifica fórmulas em todas as abas.
    checkFormulaCells(sheet, sheetName)

    const range = sheet['!ref']
      ? XLSX.utils.decode_range(sheet['!ref'])
      : null

    if (range && range.e.c + 1 > MAX_COLUMNS) {
      throw new Error(
        `A aba "${sheetName}" ultrapassa 100 colunas.`
      )
    }

    if (range && range.e.r + 1 > MAX_RECORDS + 1) {
      throw new Error(
        `A aba "${sheetName}" ultrapassa o limite de linhas permitido.`
      )
    }

    const matrix = XLSX.utils.sheet_to_json<
      string[]
    >(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: true,
    })

    const headers = (matrix[0] ?? []).map(cellToString)

    const rows = matrix
      .slice(1)
      .map((row) => row.map(cellToString))
      .filter((row) =>
        row.some((value) => value !== '')
      )

    totalRecords += rows.length

    if (totalRecords > MAX_RECORDS) {
      throw new Error(
        'O arquivo ultrapassa o limite total de 5.000 registros.'
      )
    }

    sheets.push({
      id: sheetIndex + 1,
      name: sheetName,
      rowCount: matrix.length,
      columnCount: headers.length,
    })

    data.push({
      sheetName,
      headers,
      rows,
    })
  }

  return {
    sheets,
    data,
  }
}
