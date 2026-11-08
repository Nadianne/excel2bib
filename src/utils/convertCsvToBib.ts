
import { readCsv, type CsvReadOptions } from './readCsv'
import type {
  BibConversionResult,
} from './convertXlsxToBib'

type Field =
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

const ALIASES: Record<Field, string[]> = {
  title: [
    'title', 'article title', 'document title',
    'paper title', 'titulo', 'titulo do artigo',
  ],
  author: [
    'author', 'authors', 'author names',
    'author s', 'autores', 'autor',
  ],
  year: [
    'year', 'publication year',
    'ano', 'ano de publicacao',
  ],
  journal: [
    'journal', 'journal title', 'journal name',
    'source title', 'periodico', 'revista',
  ],
  booktitle: [
    'booktitle', 'book title', 'conference',
    'conference name', 'conference title',
    'proceedings title', 'evento', 'anais',
  ],
  publisher: ['publisher', 'editora'],
  volume: ['volume', 'vol'],
  number: ['number', 'issue', 'issue number', 'numero'],
  pages: ['pages', 'page range', 'paginas'],
  doi: ['doi', 'digital object identifier'],
  url: ['url', 'link', 'article url', 'document url'],
  abstract: ['abstract', 'resumo', 'summary'],
  keywords: [
    'keywords', 'author keywords',
    'index keywords', 'palavras chave',
  ],
  isbn: ['isbn'],
  issn: ['issn'],
  type: [
    'type', 'document type', 'publication type',
    'tipo', 'tipo de publicacao',
  ],
}

const OUTPUT_FIELDS: Field[] = [
  'title', 'author', 'year', 'journal',
  'booktitle', 'publisher', 'volume',
  'number', 'pages', 'doi', 'url',
  'abstract', 'keywords', 'isbn', 'issn',
]

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function identifyColumns(
  headers: string[]
): Partial<Record<Field, number>> {
  const mapping: Partial<Record<Field, number>> = {}
  const fields = Object.keys(ALIASES) as Field[]

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

function identifyType(
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

  if (normalized === 'book' || normalized === 'livro') {
    return 'book'
  }

  if (
    normalized.includes('thesis') ||
    normalized.includes('tese') ||
    normalized.includes('dissertacao')
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

  if (booktitle.trim()) return 'inproceedings'
  if (journal.trim()) return 'article'

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
    .replace(/[\\{}%$&#_^~]/g, (char) => special[char])
    .trim()
}

function normalizeAuthors(value: string): string {
  return value
    .split(/\s*;\s*|\s*\|\s*/)
    .map((author) => author.trim())
    .filter(Boolean)
    .join(' and ')
}

function createEntry(
  values: Partial<Record<Field, string>>,
  index: number
): string {
  const entryType = identifyType(
    values.type ?? '',
    values.journal ?? '',
    values.booktitle ?? ''
  )

  const citationKey = `ref${String(index).padStart(4, '0')}`

  const fields = OUTPUT_FIELDS.flatMap((field) => {
    let value = values[field]?.trim()

    if (!value) return []

    if (field === 'author') {
      value = normalizeAuthors(value)
    }

    return `  ${field} = {${escapeBibtex(value)}}`
  })

  return [
    `@${entryType}{${citationKey},`,
    fields.join(',\n'),
    '}',
  ].join('\n')
}

export async function convertCsvToBib(
  file: File,
  options: CsvReadOptions = {}
): Promise<BibConversionResult> {
  const csv = await readCsv(file, options)

  const mapping = identifyColumns(csv.headers)

  if (mapping.title === undefined) {
    throw new Error(
      'Não foi possível identificar a coluna de título no CSV.'
    )
  }

  const fields = Object.keys(ALIASES) as Field[]
  const entries: string[] = []
  const issues: BibConversionResult['issues'] = []

  let converted = 0
  let rejected = 0

  for (let index = 0; index < csv.rows.length; index++) {
    const row = csv.rows[index]

    const values: Partial<Record<Field, string>> = {}

    for (const field of fields) {
      const columnIndex = mapping[field]

      if (columnIndex === undefined) continue

      values[field] = (row[columnIndex] ?? '').trim()
    }

    if (!values.title) {
      rejected++

      issues.push({
        row: csv.rowNumbers[index],
        reason: 'Título ausente.',
      })

      continue
    }

    converted++
    entries.push(createEntry(values, converted))
  }

  return {
    sheetName: file.name.replace(/\.csv$/i, ''),
    bibtex: entries.join('\n\n') + (entries.length ? '\n' : ''),
    converted,
    rejected,
    issues,
  }
}
