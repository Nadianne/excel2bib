
import ExcelJS from 'exceljs'

export interface ConversionIssue {
  row: number
  reason: string
}

export interface BibConversionResult {
  sheetName: string
  bibtex: string
  converted: number
  rejected: number
  issues: ConversionIssue[]
}

const MAX_RECORDS = 5000
const MAX_COLUMNS = 100

type BibField =
  | 'title'
  | 'author'
  | 'year'
  | 'journal'
  | 'booktitle'
  | 'publisher'
  | 'volume'
  | 'number'
  | 'pages'
  | 'doi'
  | 'url'
  | 'abstract'
  | 'keywords'
  | 'isbn'
  | 'issn'
  | 'type'

const ALIASES: Record<BibField, string[]> = {
  title: [
    'title',
    'article title',
    'document title',
    'paper title',
    'titulo',
    'titulo do artigo',
  ],
  author: [
    'author',
    'authors',
    'author names',
    'author s',
    'autores',
    'autor',
  ],
  year: [
    'year',
    'publication year',
    'ano',
    'ano de publicacao',
  ],
  journal: [
    'journal',
    'journal title',
    'journal name',
    'source title',
    'periodico',
    'revista',
  ],
  booktitle: [
    'booktitle',
    'book title',
    'conference',
    'conference name',
    'conference title',
    'proceedings title',
    'evento',
    'anais',
  ],
  publisher: [
    'publisher',
    'editora',
  ],
  volume: [
    'volume',
    'vol',
  ],
  number: [
    'number',
    'issue',
    'issue number',
    'numero',
  ],
  pages: [
    'pages',
    'page range',
    'paginas',
  ],
  doi: [
    'doi',
    'digital object identifier',
  ],
  url: [
    'url',
    'link',
    'article url',
    'document url',
  ],
  abstract: [
    'abstract',
    'resumo',
    'summary',
  ],
  keywords: [
    'keywords',
    'author keywords',
    'index keywords',
    'palavras chave',
  ],
  isbn: ['isbn'],
  issn: ['issn'],
  type: [
    'type',
    'document type',
    'publication type',
    'tipo',
    'tipo de publicacao',
  ],
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'object') {
    // Defesa adicional contra fórmulas.
    if ('formula' in value || 'sharedFormula' in value) {
      throw new Error(
        'Foi encontrada uma fórmula durante a conversão.'
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

function identifyColumns(
  headers: string[]
): Partial<Record<BibField, number>> {
  const mapping: Partial<Record<BibField, number>> = {}
  const fields = Object.keys(ALIASES) as BibField[]

  headers.forEach((header, index) => {
    const normalized = normalize(header)

    for (const field of fields) {
      if (
        mapping[field] === undefined &&
        ALIASES[field].some(
          (alias) => normalize(alias) === normalized
        )
      ) {
        mapping[field] = index
        break
      }
    }
  })

  return mapping
}

function identifyEntryType(
  type: string,
  journal: string,
  booktitle: string
): string {
  const normalized = normalize(type)

  if (
    normalized.includes('conference') ||
    normalized.includes('proceedings') ||
    normalized.includes('conferencia') ||
    normalized.includes('congresso')
  ) {
    return 'inproceedings'
  }

  if (
    normalized.includes('book chapter') ||
    normalized.includes('capitulo')
  ) {
    return 'incollection'
  }

  if (
    normalized === 'book' ||
    normalized === 'livro'
  ) {
    return 'book'
  }

  if (
    normalized.includes('thesis') ||
    normalized.includes('dissertacao') ||
    normalized.includes('tese')
  ) {
    return 'phdthesis'
  }

  if (
    normalized.includes('report') ||
    normalized.includes('relatorio')
  ) {
    return 'techreport'
  }

  if (
    normalized.includes('article') ||
    normalized.includes('artigo') ||
    normalized.includes('journal')
  ) {
    return 'article'
  }

  if (booktitle.trim()) {
    return 'inproceedings'
  }

  if (journal.trim()) {
    return 'article'
  }

  return 'misc'
}

function escapeBibtex(value: string): string {
  const special: Record<string, string> = {
    '\\': '\\textbackslash{}',
    '{': '\\{',
    '}': '\\}',
    '%': '\\%',
    '$': '\\$',
    '&': '\\&',
    '#': '\\#',
    '_': '\\_',
    '^': '\\^{}',
    '~': '\\~{}',
  }

  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(
      /[\\{}%$&#_^~]/g,
      (char) => special[char]
    )
    .trim()
}

function normalizeAuthors(value: string): string {
  return value
    .split(/\s*;\s*|\s*\|\s*/)
    .map((author) => author.trim())
    .filter(Boolean)
    .join(' and ')
}

function createBibEntry(
  values: Partial<Record<BibField, string>>,
  index: number
): string {
  const entryType = identifyEntryType(
    values.type ?? '',
    values.journal ?? '',
    values.booktitle ?? ''
  )

  const citationKey =
    `ref${String(index).padStart(4, '0')}`

  const fields: string[] = []

  const bibFields: BibField[] = [
    'title',
    'author',
    'year',
    'journal',
    'booktitle',
    'publisher',
    'volume',
    'number',
    'pages',
    'doi',
    'url',
    'abstract',
    'keywords',
    'isbn',
    'issn',
  ]

  for (const field of bibFields) {
    let value = values[field]?.trim()

    if (!value) continue

    if (field === 'author') {
      value = normalizeAuthors(value)
    }

    fields.push(
      `  ${field} = {${escapeBibtex(value)}}`
    )
  }

  return [
    `@${entryType}{${citationKey},`,
    fields.join(',\n'),
    '}',
  ].join('\n')
}

export async function convertXlsxToBib(
  file: File,
  sheetName: string
): Promise<BibConversionResult> {
  // O arquivo deve passar pelas validações
  // preliminares antes desta função.

  // Leitura direta pelo ExcelJS.
  const workbook = new ExcelJS.Workbook()
  const buffer = new Uint8Array(
    await file.arrayBuffer()
  )

  await workbook.xlsx.load(buffer as never)

  const worksheet = workbook.getWorksheet(sheetName)

  if (!worksheet) {
    throw new Error(
      'A aba selecionada não foi encontrada.'
    )
  }

  if (
    worksheet.columnCount === 0 ||
    worksheet.columnCount > MAX_COLUMNS
  ) {
    throw new Error(
      'A planilha possui uma quantidade de colunas não suportada.'
    )
  }

  const columnCount = worksheet.columnCount

  const headers = Array.from(
    { length: columnCount },
    (_, index) =>
      cellToText(
        worksheet.getRow(1).getCell(index + 1).value
      )
  )

  const mapping = identifyColumns(headers)

  if (mapping.title === undefined) {
    throw new Error(
      'Não foi possível identificar a coluna de título.'
    )
  }

  const issues: ConversionIssue[] = []
  const entries: string[] = []

  let processed = 0
  let converted = 0
  let rejected = 0

  const fields = Object.keys(ALIASES) as BibField[]

  for (
    let rowIndex = 2;
    rowIndex <= worksheet.rowCount;
    rowIndex++
  ) {
    const row = worksheet.getRow(rowIndex)

    const isEmpty = Array.from(
      { length: columnCount },
      (_, index) =>
        row.getCell(index + 1).value
    ).every(
      (value) => cellToText(value).trim() === ''
    )

    if (isEmpty) continue

    processed++

    if (processed > MAX_RECORDS) {
      throw new Error(
        'O limite de 5.000 registros foi ultrapassado.'
      )
    }

    const values: Partial<Record<BibField, string>> = {}

    for (const field of fields) {
      const columnIndex = mapping[field]

      if (columnIndex === undefined) continue

      values[field] = cellToText(
        row.getCell(columnIndex + 1).value
      ).trim()
    }

    if (!values.title) {
      rejected++

      issues.push({
        row: rowIndex,
        reason: 'Título ausente.',
      })

      continue
    }

    converted++

    entries.push(
      createBibEntry(values, converted)
    )
  }

  return {
    sheetName,
    bibtex:
      entries.join('\n\n') +
      (entries.length ? '\n' : ''),
    converted,
    rejected,
    issues,
  }
}
