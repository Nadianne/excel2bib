
import Papa from 'papaparse'

const MAX_FILE_SIZE = 25 * 1024 * 1024
const MAX_RECORDS = 5000
const MAX_COLUMNS = 100

export type CsvEncoding = 'utf-8' | 'windows-1252'
export type CsvDelimiter = ',' | ';' | '\t' | '|'

export interface CsvReadOptions {
  encoding?: CsvEncoding
  delimiter?: CsvDelimiter
}

export interface CsvReadResult {
  name: string
  encoding: CsvEncoding
  delimiter: CsvDelimiter
  headers: string[]
  rows: string[][]
  rowNumbers: number[]
  rowCount: number
  columnCount: number
}

function detectEncoding(bytes: Uint8Array): CsvEncoding {
  // Rejeita UTF-16, que precisa de tratamento específico.
  if (
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes[0] === 0xfe && bytes[1] === 0xff)
  ) {
    throw new Error(
      'CSV em UTF-16 ainda não é suportado.'
    )
  }

  const utf8 = new TextDecoder('utf-8', {
    fatal: true,
  })

  try {
    utf8.decode(bytes)
    return 'utf-8'
  } catch {
    return 'windows-1252'
  }
}

export async function readCsv(
  file: File,
  options: CsvReadOptions = {}
): Promise<CsvReadResult> {
  if (file.size === 0) {
    throw new Error('O arquivo CSV está vazio.')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('O arquivo ultrapassa 25 MB.')
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  const encoding = options.encoding ?? detectEncoding(bytes)

  const decoder = new TextDecoder(encoding, {
    fatal: true,
  })

  const content = decoder.decode(bytes).replace(/^\uFEFF/, '')

  if (content.includes('\u0000')) {
    throw new Error(
      'O CSV contém caracteres nulos não permitidos.'
    )
  }

  const result = Papa.parse<string[]>(content, {
    header: false,
    delimiter: options.delimiter ?? '',
    delimitersToGuess: [',', ';', '\t', '|'],
    skipEmptyLines: false,
    dynamicTyping: false,
    comments: false,
  })

  const relevantErrors = result.errors.filter(
    (error) => error.code !== 'UndetectableDelimiter'
  )

  if (relevantErrors.length > 0) {
    throw new Error(
      `CSV inválido: ${relevantErrors[0].message}`
    )
  }

  const delimiter = result.meta.delimiter

  if (
    delimiter !== ',' &&
    delimiter !== ';' &&
    delimiter !== '\t' &&
    delimiter !== '|'
  ) {
    throw new Error(
      'Não foi possível identificar o separador do CSV.'
    )
  }

  const allRows = result.data

  if (allRows.length === 0) {
    throw new Error('O CSV não contém dados.')
  }

  const headers = allRows[0].map((value) => value.trim())

  if (
    headers.length === 0 ||
    headers.length > MAX_COLUMNS ||
    headers.every((value) => value === '')
  ) {
    throw new Error(
      'O CSV não possui cabeçalhos válidos ou excede 100 colunas.'
    )
  }

  const rows: string[][] = []
  const rowNumbers: number[] = []

  for (let index = 1; index < allRows.length; index++) {
    const current = allRows[index]

    if (current.every((value) => value.trim() === '')) {
      continue
    }

    if (current.length !== headers.length) {
      throw new Error(
        `O registro ${index + 1} possui quantidade incorreta de colunas.`
      )
    }

    if (rows.length >= MAX_RECORDS) {
      throw new Error(
        'O limite de 5.000 registros foi ultrapassado.'
      )
    }

    rows.push(current)
    rowNumbers.push(index + 1)
  }

  return {
    name: file.name,
    encoding,
    delimiter,
    headers,
    rows,
    rowNumbers,
    rowCount: rows.length + 1,
    columnCount: headers.length,
  }
}
