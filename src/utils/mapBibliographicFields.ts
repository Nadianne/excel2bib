
export const BIBLIOGRAPHIC_FIELDS = [
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
  'type',
] as const

export type BibliographicField =
  (typeof BIBLIOGRAPHIC_FIELDS)[number]

export type BibliographicMapping = Record<
  BibliographicField,
  number | null
>

export interface BibliographicFieldOption {
  value: BibliographicField
  label: string
  required: boolean
}

export const FIELD_OPTIONS: BibliographicFieldOption[] = [
  { value: 'title', label: 'Título', required: true },
  { value: 'author', label: 'Autores', required: false },
  { value: 'year', label: 'Ano', required: false },
  { value: 'journal', label: 'Periódico', required: false },
  { value: 'booktitle', label: 'Evento ou livro', required: false },
  { value: 'publisher', label: 'Editora', required: false },
  { value: 'volume', label: 'Volume', required: false },
  { value: 'number', label: 'Número', required: false },
  { value: 'pages', label: 'Páginas', required: false },
  { value: 'doi', label: 'DOI', required: false },
  { value: 'url', label: 'URL', required: false },
  { value: 'abstract', label: 'Resumo', required: false },
  { value: 'keywords', label: 'Palavras-chave', required: false },
  { value: 'isbn', label: 'ISBN', required: false },
  { value: 'issn', label: 'ISSN', required: false },
  { value: 'type', label: 'Tipo de publicação', required: false },
]

/**
 * Sinônimos usados para reconhecer cabeçalhos.
 *
 * Todos os valores são normalizados antes
 * da comparação.
 */
const FIELD_ALIASES: Record<
  BibliographicField,
  string[]
> = {
  title: [
    'title',
    'article title',
    'document title',
    'publication title',
    'paper title',
    'titulo',
    'titulo do artigo',
    'titulo do documento',
    'nome do artigo',
  ],

  author: [
    'author',
    'authors',
    'author names',
    'author name',
    'author s',
    'autores',
    'autor',
    'nome dos autores',
  ],

  year: [
    'year',
    'publication year',
    'published year',
    'ano',
    'ano de publicacao',
    'ano da publicacao',
  ],

  journal: [
    'journal',
    'journal title',
    'journal name',
    'source title',
    'periodico',
    'nome do periodico',
    'revista',
    'revista cientifica',
  ],

  booktitle: [
    'booktitle',
    'book title',
    'conference',
    'conference name',
    'conference title',
    'proceedings title',
    'nome do evento',
    'evento',
    'anais',
  ],

  publisher: [
    'publisher',
    'editora',
    'nome da editora',
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
    'numero da edicao',
    'fasciculo',
  ],

  pages: [
    'pages',
    'page range',
    'page numbers',
    'paginas',
    'pagina',
    'intervalo de paginas',
  ],

  doi: [
    'doi',
    'doi link',
    'digital object identifier',
    'identificador doi',
  ],

  url: [
    'url',
    'link',
    'document url',
    'article url',
    'article link',
    'website',
    'endereco eletronico',
  ],

  abstract: [
    'abstract',
    'summary',
    'resumo',
    'resumo do artigo',
  ],

  keywords: [
    'keywords',
    'author keywords',
    'index keywords',
    'key words',
    'palavras chave',
    'palavras chaves',
    'termos chave',
  ],

  isbn: [
    'isbn',
  ],

  issn: [
    'issn',
  ],

  type: [
    'type',
    'document type',
    'publication type',
    'article type',
    'tipo',
    'tipo de documento',
    'tipo de publicacao',
    'tipo de artigo',
  ],
}

/**
 * Remove diferenças comuns de acentuação,
 * capitalização e pontuação.
 *
 * Exemplo:
 * "Título do Artigo" -> "titulo do artigo"
 */
export function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Retorna o campo bibliográfico correspondente
 * a um cabeçalho, se houver reconhecimento.
 */
export function identifyBibliographicField(
  header: string
): BibliographicField | null {
  const normalized = normalizeHeader(header)

  if (!normalized) {
    return null
  }

  for (const field of BIBLIOGRAPHIC_FIELDS) {
    const aliases = FIELD_ALIASES[field]

    if (
      aliases.some(
        (alias) => normalizeHeader(alias) === normalized
      )
    ) {
      return field
    }
  }

  return null
}

/**
 * Cria um mapeamento vazio.
 */
export function createEmptyMapping(): BibliographicMapping {
  return {
    title: null,
    author: null,
    year: null,
    journal: null,
    booktitle: null,
    publisher: null,
    volume: null,
    number: null,
    pages: null,
    doi: null,
    url: null,
    abstract: null,
    keywords: null,
    isbn: null,
    issn: null,
    type: null,
  }
}

/**
 * Identifica automaticamente as colunas.
 *
 * O índice é baseado em zero.
 *
 * Se dois cabeçalhos corresponderem ao mesmo
 * campo, o primeiro será utilizado.
 */
export function mapBibliographicFields(
  headers: string[]
): BibliographicMapping {
  const mapping = createEmptyMapping()

  headers.forEach((header, index) => {
    const field = identifyBibliographicField(header)

    if (field && mapping[field] === null) {
      mapping[field] = index
    }
  })

  return mapping
}

/**
 * Verifica se existe uma coluna associada
 * ao campo obrigatório title.
 *
 * Essa função não verifica os títulos de
 * cada registro. Isso será feito na conversão.
 */
export function hasTitleMapping(
  mapping: BibliographicMapping
): boolean {
  return mapping.title !== null
}

/**
 * Retorna a quantidade de campos identificados.
 */
export function countMappedFields(
  mapping: BibliographicMapping
): number {
  return BIBLIOGRAPHIC_FIELDS.filter(
    (field) => mapping[field] !== null
  ).length
}
