
import { useRef, useState, type ChangeEvent } from 'react'
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Table2,
  Eye,
  LoaderCircle,
  Download,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
} from 'lucide-react'

import { detectFileFormat } from './utils/detectFileFormat'
import { validateXlsxStructure } from './utils/validateXlsxStructure'
import type { XlsxSheetInfo } from './utils/readXlsx'
import { IssuesReportDownload } from './components/IssuesReportDownload'

import type { XlsxPreview } from './utils/previewXlsx'
import type { BibConversionResult } from './utils/convertXlsxToBib'

const MAX_FILE_SIZE = 25 * 1024 * 1024
const MAX_RECORDS = 5000
const ALLOWED_EXTENSIONS = ['csv', 'xlsx', 'xls']

type Step = 1 | 2 | 3
type SupportedFormat = 'xlsx' | 'csv' | 'xls'

const STEPS = [
  { number: 1, label: 'Arquivo' },
  { number: 2, label: 'Abas' },
  { number: 3, label: 'Resultado' },
] as const

function getReadableError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Não foi possível processar o arquivo. Tente novamente.'
  }

  const message = error.message
  const normalized = message.toLowerCase()

  if (normalized.includes('fórmula') || normalized.includes('formula')) {
    return (
      'A planilha contém fórmulas e não pode ser convertida. ' +
      'Substitua as fórmulas por valores e tente novamente.'
    )
  }

  if (normalized.includes('macro') || normalized.includes('vba')) {
    return (
      'O arquivo contém componentes não permitidos, como macros. ' +
      'Utilize uma planilha sem macros.'
    )
  }

  if (normalized.includes('5.000') || normalized.includes('5000')) {
    return (
      'O arquivo ultrapassa o limite de 5.000 registros por conversão.'
    )
  }

  if (
    normalized.includes('coluna de título') ||
    normalized.includes('coluna de titulo')
  ) {
    return (
      'Não encontramos uma coluna de título. ' +
      'Verifique os cabeçalhos da planilha.'
    )
  }

  if (normalized.includes('25 mb')) {
    return 'O arquivo ultrapassa o limite de 25 MB.'
  }

  if (
    normalized.includes('separador') ||
    normalized.includes('codificação') ||
    normalized.includes('utf-16') ||
    normalized.includes('csv inválido')
  ) {
    return (
      'Não foi possível interpretar o arquivo CSV. ' +
      'Verifique a codificação e o separador utilizado.'
    )
  }

  return (
    'Não foi possível ler esta planilha. O arquivo pode estar ' +
    'em um formato ou estrutura incompatível. Verifique o arquivo ' +
    'e tente salvá-lo novamente no formato apropriado.'
  )
}

function App() {
  const [step, setStep] = useState<Step>(1)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFormat, setSelectedFormat] =
    useState<SupportedFormat | null>(null)

  const [fileError, setFileError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  const [xlsxSheets, setXlsxSheets] = useState<XlsxSheetInfo[]>([])
  const [selectedSheetIds, setSelectedSheetIds] = useState<number[]>([])

  const [preview, setPreview] = useState<XlsxPreview | null>(null)
  const [previewSheetId, setPreviewSheetId] = useState<number | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [conversionResults, setConversionResults] = useState<
    BibConversionResult[]
  >([])

  const [conversionError, setConversionError] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileRequestRef = useRef(0)
  const previewRequestRef = useRef(0)
  const conversionRequestRef = useRef(0)

  const allSheetsSelected =
    xlsxSheets.length > 0 &&
    selectedSheetIds.length === xlsxSheets.length

  const totalConverted = conversionResults.reduce(
    (total, result) => total + result.converted,
    0
  )

  const totalRejected = conversionResults.reduce(
    (total, result) => total + result.rejected,
    0
  )

  function clearPreview() {
    previewRequestRef.current += 1
    setPreview(null)
    setPreviewSheetId(null)
    setPreviewError(null)
    setIsPreviewLoading(false)
  }

  function clearConversion() {
    conversionRequestRef.current += 1
    setConversionResults([])
    setConversionError(null)
    setIsConverting(false)
  }

  function handleSelectAll(checked: boolean) {
    if (isConverting) return

    setSelectedSheetIds(
      checked ? xlsxSheets.map((sheet) => sheet.id) : []
    )

    clearPreview()
    clearConversion()
  }

  function handleSheetSelection(
    sheetId: number,
    checked: boolean
  ) {
    if (isConverting) return

    setSelectedSheetIds((current) =>
      checked
        ? current.includes(sheetId)
          ? current
          : [...current, sheetId]
        : current.filter((id) => id !== sheetId)
    )

    clearPreview()
    clearConversion()
  }

  function restart() {
    fileRequestRef.current += 1

    clearPreview()
    clearConversion()

    setSelectedFile(null)
    setSelectedFormat(null)
    setFileError(null)
    setIsValidating(false)
    setXlsxSheets([])
    setSelectedSheetIds([])
    setStep(1)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]
    const requestId = ++fileRequestRef.current

    setSelectedFile(null)
    setSelectedFormat(null)
    setFileError(null)
    setXlsxSheets([])
    setSelectedSheetIds([])
    setIsValidating(false)

    clearPreview()
    clearConversion()

    if (!file) return

    event.target.value = ''

    const extension = file.name.split('.').pop()?.toLowerCase()

    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      setFileError(
        'Formato não permitido. Utilize CSV, XLSX ou XLS.'
      )
      return
    }

    if (file.size === 0) {
      setFileError('O arquivo está vazio.')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError('O arquivo ultrapassa o limite de 25 MB.')
      return
    }

    setIsValidating(true)

    try {
      const detectedFormat = await detectFileFormat(file)

      if (requestId !== fileRequestRef.current) return

      if (detectedFormat !== extension) {
        setFileError(
          'O conteúdo do arquivo não corresponde à extensão informada.'
        )
        return
      }

      // LEITURA CSV
      if (detectedFormat === 'csv') {
        const { readCsv } = await import('./utils/readCsv')
        const csv = await readCsv(file)

        if (requestId !== fileRequestRef.current) return

        const csvSheet: XlsxSheetInfo = {
          id: 1,
          name: file.name.replace(/\.csv$/i, ''),
          rowCount: csv.rowCount,
          columnCount: csv.columnCount,
        }

        setXlsxSheets([csvSheet])
        setSelectedSheetIds([csvSheet.id])
        setSelectedFormat('csv')
        setSelectedFile(file)

        return
      }

      // LEITURA XLS
      if (detectedFormat === 'xls') {
        const { readXls } = await import('./utils/readXls')
        const workbook = await readXls(file)

        if (requestId !== fileRequestRef.current) return

        if (workbook.sheets.length === 0) {
          setFileError(
            'Nenhuma aba foi encontrada no arquivo XLS.'
          )
          return
        }

        setXlsxSheets(workbook.sheets)
        setSelectedSheetIds(
          workbook.sheets.map((sheet) => sheet.id)
        )
        setSelectedFormat('xls')
        setSelectedFile(file)

        return
      }

      // LEITURA XLSX
      if (detectedFormat === 'xlsx') {
        const validation = await validateXlsxStructure(file)

        if (requestId !== fileRequestRef.current) return

        if (!validation.valid) {
          setFileError(validation.message)
          return
        }

        // Validação obrigatória: o mesmo ExcelJS usado na conversão
        // precisa conseguir ler o XLSX, sem fallback para SheetJS.
        // Não armazene o arquivo como selecionado antes desta leitura.
        const { default: ExcelJS } = await import('exceljs')
        const workbook = new ExcelJS.Workbook()
        const bytes = new Uint8Array(await file.arrayBuffer())
        await workbook.xlsx.load(bytes as never)

        if (requestId !== fileRequestRef.current) return

        const sheets: XlsxSheetInfo[] = workbook.worksheets.map((sheet) => {
          // Confirma que as dimensões e o cabeçalho são acessíveis.
          if (sheet.columnCount > 100) {
            throw new Error('A planilha possui mais de 100 colunas.')
          }
          for (let column = 1; column <= sheet.columnCount; column++) {
            void sheet.getRow(1).getCell(column).value
          }

          return {
            id: sheet.id,
            name: sheet.name,
            rowCount: sheet.rowCount,
            columnCount: sheet.columnCount,
          }
        })

        if (sheets.length === 0) {
          setFileError(
            'Nenhuma aba foi encontrada no arquivo XLSX.'
          )
          return
        }

        setXlsxSheets(sheets)
        setSelectedSheetIds(
          sheets.map((sheet) => sheet.id)
        )
        setSelectedFormat('xlsx')
        setSelectedFile(file)

        return
      }

      setFileError(
        'Não foi possível reconhecer o formato do arquivo.'
      )
    } catch (error) {
      if (requestId !== fileRequestRef.current) return

      console.error(
        'Excel2Bib — erro técnico durante a leitura:',
        error
      )

      setSelectedFile(null)
      setSelectedFormat(null)
      setXlsxSheets([])
      setSelectedSheetIds([])

      setFileError(getReadableError(error))
    } finally {
      if (requestId === fileRequestRef.current) {
        setIsValidating(false)
      }
    }
  }

  async function handlePreview(sheet: XlsxSheetInfo) {
    if (
      !selectedFile ||
      !selectedFormat ||
      !selectedSheetIds.includes(sheet.id) ||
      isConverting
    ) {
      return
    }

    const requestId = ++previewRequestRef.current

    setPreview(null)
    setPreviewSheetId(sheet.id)
    setPreviewError(null)
    setIsPreviewLoading(true)

    try {
      let result: XlsxPreview

      if (selectedFormat === 'csv') {
        const { readCsv } = await import('./utils/readCsv')
        const csv = await readCsv(selectedFile)

        result = {
          sheetName: sheet.name,
          headers: csv.headers,
          rows: csv.rows.slice(0, 10),
        }
      } else if (selectedFormat === 'xls') {
        const { readXls } = await import('./utils/readXls')
        const workbook = await readXls(selectedFile)

        const selectedSheet = workbook.data.find(
          (item) => item.sheetName === sheet.name
        )

        if (!selectedSheet) {
          throw new Error(
            'A aba selecionada não foi encontrada no XLS.'
          )
        }

        result = {
          sheetName: selectedSheet.sheetName,
          headers: selectedSheet.headers,
          rows: selectedSheet.rows.slice(0, 10),
        }
      } else {
        const { previewXlsx } = await import(
          './utils/previewXlsx'
        )

        result = await previewXlsx(
          selectedFile,
          sheet.name
        )
      }

      if (requestId !== previewRequestRef.current) return

      setPreview(result)
    } catch (error) {
      if (requestId !== previewRequestRef.current) return

      console.error(
        'Excel2Bib — erro técnico na pré-visualização:',
        error
      )

      setPreviewError(
        'Não foi possível exibir os registros desta aba. ' +
        'Verifique se o arquivo está em um formato compatível.'
      )
    } finally {
      if (requestId === previewRequestRef.current) {
        setIsPreviewLoading(false)
      }
    }
  }

  async function handleConvert() {
    if (
      !selectedFile ||
      !selectedFormat ||
      selectedSheetIds.length === 0 ||
      isConverting ||
      isValidating ||
      isPreviewLoading
    ) {
      return
    }

    const requestId = ++conversionRequestRef.current

    setConversionResults([])
    setConversionError(null)
    setIsConverting(true)

    try {
      const selectedSheets = xlsxSheets.filter(
        (sheet) => selectedSheetIds.includes(sheet.id)
      )

      const results: BibConversionResult[] = []
      let processedTotal = 0

      // CONVERSÃO CSV
      if (selectedFormat === 'csv') {
        const { convertCsvToBib } = await import(
          './utils/convertCsvToBib'
        )

        const result = await convertCsvToBib(selectedFile)

        if (requestId !== conversionRequestRef.current) {
          return
        }

        processedTotal = result.converted + result.rejected

        if (processedTotal > MAX_RECORDS) {
          throw new Error(
            'O limite de 5.000 registros foi ultrapassado.'
          )
        }

        results.push(result)
      } else if (selectedFormat === 'xls') {
        // CONVERSÃO XLS
        const { convertXlsToBib } = await import(
          './utils/convertXlsToBib'
        )

        for (const sheet of selectedSheets) {
          const result = await convertXlsToBib(
            selectedFile,
            sheet.name
          )

          if (requestId !== conversionRequestRef.current) {
            return
          }

          processedTotal += result.converted + result.rejected

          if (processedTotal > MAX_RECORDS) {
            throw new Error(
              'O limite de 5.000 registros por conversão foi ultrapassado.'
            )
          }

          results.push(result)
        }
      } else {
        // CONVERSÃO XLSX
        const { convertXlsxToBib } = await import(
          './utils/convertXlsxToBib'
        )

        for (const sheet of selectedSheets) {
          const result = await convertXlsxToBib(
            selectedFile,
            sheet.name
          )

          if (requestId !== conversionRequestRef.current) {
            return
          }

          processedTotal += result.converted + result.rejected

          if (processedTotal > MAX_RECORDS) {
            throw new Error(
              'O limite de 5.000 registros por conversão foi ultrapassado.'
            )
          }

          results.push(result)
        }
      }

      if (requestId !== conversionRequestRef.current) {
        return
      }

      setConversionResults(results)
      setStep(3)
    } catch (error) {
      if (requestId !== conversionRequestRef.current) {
        return
      }

      console.error(
        'Excel2Bib — erro técnico na conversão:',
        error
      )

      setConversionResults([])
      setConversionError(getReadableError(error))
    } finally {
      if (requestId === conversionRequestRef.current) {
        setIsConverting(false)
      }
    }
  }

  function downloadBib(result: BibConversionResult) {
    if (!result.bibtex || result.converted === 0) return

    const safeName =
      result.sheetName
        .replace(/[<>:"/\\|?*]/g, '_')
        .split('')
        .map((char) =>
          char.charCodeAt(0) < 32 ? '_' : char
        )
        .join('')
        .replace(/^\.+$/, 'aba')
        .slice(0, 100) || 'aba'

    const blob = new Blob([result.bibtex], {
      type: 'application/x-bibtex;charset=utf-8',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `${safeName}.bib`

    document.body.appendChild(link)
    link.click()
    link.remove()

    window.setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 1000)
  }

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <style>{`
        @keyframes excel2bib-enter {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes excel2bib-soft-glow {
          0%, 100% { opacity: .48; }
          50% { opacity: .9; }
        }
        .e2b-enter { animation: excel2bib-enter .7s cubic-bezier(.2,.8,.2,1) both; }
        .e2b-enter-delayed { animation: excel2bib-enter .85s .15s cubic-bezier(.2,.8,.2,1) both; }
        .e2b-enter-later { animation: excel2bib-enter .85s .28s cubic-bezier(.2,.8,.2,1) both; }
        .e2b-accent { animation: excel2bib-soft-glow 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .e2b-enter, .e2b-enter-delayed, .e2b-enter-later, .e2b-accent {
            animation: none !important;
          }
        }
      `}</style>
      {/* COLUNA ESQUERDA — CONVERSOR */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-[#2D2D2D] px-5 py-10 text-white sm:px-8 lg:py-12">
        <header className="e2b-enter w-full max-w-xl text-center">
          <img
            src="/images/logo.png"
            alt="Excel2Bib — Conversor de planilhas para BibTeX"
            className="mx-auto w-full max-w-[340px] object-contain sm:max-w-[365px]"
          />

          <p className="mt-2 text-sm text-gray-300">
            De planilhas a referências BibTeX em poucos cliques.
          </p>
        </header>

        <div className="flex w-full max-w-xl flex-col items-center">
          <div className="e2b-enter-delayed mt-9 w-full text-center">
            <h1 className="text-2xl font-semibold">
              Suas referências, prontas para o Parsif.al.
            </h1>

            <p className="mt-3 text-sm text-gray-300">
              Converta suas referências de forma simples e organizada.
            </p>

            {/* Fluxo compacto: da planilha à plataforma. */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-gray-300" aria-label="Fluxo: Excel e CSV para BibTeX e Parsif.al">
              <span className="rounded border border-white/15 bg-white/[0.04] px-3 py-1.5">Excel / CSV</span>
              <ArrowRight size={15} className="text-[#00D88A]" aria-hidden="true" />
              <span className="rounded border border-[#E95AAE]/35 bg-[#E95AAE]/[0.06] px-3 py-1.5 text-white">BibTeX</span>
              <ArrowRight size={15} className="text-[#E95AAE]" aria-hidden="true" />
              <span className="rounded border border-white/15 bg-white/[0.04] px-3 py-1.5">Parsif.al</span>
            </div>
          </div>

          {/* PAINEL ÚNICO */}
          <div className="e2b-enter-later mt-6 w-full rounded-lg border border-white/[0.05] bg-[#383838] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.08)] sm:p-6">
            {/* INDICADOR DE ETAPAS */}
            <div className="grid grid-cols-3 gap-2">
              {STEPS.map((item) => (
                <div key={item.number} className="text-center">
                  <div
                    className={
                      'mb-2 h-1 rounded-full ' +
                      (step >= item.number
                        ? 'bg-[#00D88A]'
                        : 'bg-gray-600')
                    }
                  />

                  <span
                    className={
                      'text-xs ' +
                      (step === item.number
                        ? 'font-semibold text-white'
                        : 'text-gray-400')
                    }
                    aria-current={
                      step === item.number
                        ? 'step'
                        : undefined
                    }
                  >
                    {item.number}. {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* ETAPA 1 — ARQUIVO */}
            {step === 1 && (
              <div className="mt-7">
                <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-gray-500 px-5 py-8 text-center">
                  <FileSpreadsheet
                    size={40}
                    strokeWidth={1.5}
                    className="text-white"
                    aria-hidden="true"
                  />

                  <h2 className="mt-4 text-lg font-semibold">
                    Selecione sua planilha
                  </h2>

                  <p className="mt-2 text-xs text-gray-400">
                    CSV · XLSX · XLS — Até 25 MB
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="sr-only"
                    aria-label="Selecionar planilha"
                    tabIndex={-1}
                  />

                  <button
                    type="button"
                    disabled={isValidating}
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    className="mt-6 flex items-center gap-2 rounded-lg bg-[#7979F0] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#6868E0] disabled:opacity-50"
                  >
                    <Upload
                      size={17}
                      aria-hidden="true"
                    />

                    {isValidating
                      ? 'Verificando...'
                      : 'Selecionar arquivo'}
                  </button>

                  {isValidating && (
                    <p
                      role="status"
                      className="mt-4 flex items-center gap-2 text-sm text-gray-300"
                    >
                      <LoaderCircle
                        size={17}
                        className="animate-spin"
                      />

                      Lendo o arquivo...
                    </p>
                  )}

                  {selectedFile && !isValidating && (
                    <div className="mt-5 flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 text-[#00D88A]">
                        <CheckCircle2
                          size={19}
                          aria-hidden="true"
                        />

                        <span className="text-sm font-medium">
                          Arquivo selecionado!
                        </span>
                      </div>

                      <p className="max-w-full break-all text-sm text-gray-200">
                        {selectedFile.name}
                      </p>

                      <p className="text-xs text-gray-400">
                        {selectedFormat === 'csv'
                          ? 'Arquivo CSV reconhecido'
                          : `${xlsxSheets.length} aba(s) identificada(s)`}
                      </p>
                    </div>
                  )}

                  {fileError && !isValidating && (
                    <div
                      role="alert"
                      className="mt-5 flex items-start gap-2 text-left text-sm text-red-400"
                    >
                      <AlertCircle
                        size={19}
                        className="shrink-0"
                        aria-hidden="true"
                      />

                      <span>{fileError}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!selectedFile || isValidating}
                  onClick={() => setStep(2)}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#00D88A] px-5 py-3 font-semibold text-black transition hover:bg-[#00C47D] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continuar
                  <ArrowRight size={19} aria-hidden="true" />
                </button>
              </div>
            )}

            {/* ETAPA 2 — ABAS E PRÉ-VISUALIZAÇÃO */}
            {step === 2 && selectedFile && (
              <div className="mt-7">
                <h2 className="text-lg font-semibold">
                  {selectedFormat === 'csv'
                    ? 'Confira os dados do CSV'
                    : 'Escolha as abas'}
                </h2>

                <p className="mt-2 break-all text-xs text-gray-400">
                  {selectedFile.name}
                </p>

                <p className="mt-2 text-sm text-gray-300">
                  {selectedFormat === 'csv'
                    ? 'Confira a estrutura do arquivo antes de converter.'
                    : 'Selecione as abas que deseja converter.'}
                </p>

                {/* SELECIONAR TODAS — XLS/XLSX */}
                {selectedFormat !== 'csv' && (
                  <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-black/10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allSheetsSelected}
                      disabled={isConverting}
                      onChange={(event) =>
                        handleSelectAll(event.target.checked)
                      }
                      className="h-4 w-4 accent-[#00D88A]"
                    />

                    <span className="text-sm font-medium">
                      Selecionar todas
                    </span>
                  </label>
                )}

                {/* ABAS DISPONÍVEIS */}
                <div className="mt-3 space-y-2">
                  {xlsxSheets.map((sheet) => {
                    const isSelected =
                      selectedSheetIds.includes(sheet.id)

                    return (
                      <div
                        key={sheet.id}
                        className="rounded-lg border border-white/10 bg-black/20 p-3"
                      >
                        <label className="flex cursor-pointer items-center gap-3">
                          {selectedFormat !== 'csv' && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isConverting}
                              onChange={(event) =>
                                handleSheetSelection(
                                  sheet.id,
                                  event.target.checked
                                )
                              }
                              className="h-4 w-4 shrink-0 accent-[#00D88A]"
                            />
                          )}

                          <Table2
                            size={19}
                            className="shrink-0 text-[#00D88A]"
                            aria-hidden="true"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {sheet.name}
                            </p>

                            <p className="mt-1 text-xs text-gray-400">
                              {sheet.rowCount} linhas ·{' '}
                              {sheet.columnCount} colunas
                            </p>
                          </div>
                        </label>

                        {isSelected && (
                          <button
                            type="button"
                            disabled={
                              isPreviewLoading ||
                              isConverting
                            }
                            onClick={() => handlePreview(sheet)}
                            className="mt-3 flex items-center gap-2 rounded-lg border border-[#7979F0]/40 px-3 py-2 text-xs font-medium text-[#C7C7FF] transition hover:bg-[#7979F0]/15 disabled:opacity-50"
                          >
                            <Eye size={15} aria-hidden="true" />
                            Visualizar 10 registros
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>

                {selectedFormat !== 'csv' && (
                  <p className="mt-4 text-xs text-gray-300">
                    {selectedSheetIds.length} de{' '}
                    {xlsxSheets.length} abas selecionadas.
                  </p>
                )}

                {selectedSheetIds.length === 0 && (
                  <p className="mt-2 text-xs text-amber-300">
                    Selecione pelo menos uma aba.
                  </p>
                )}

                {/* PRÉ-VISUALIZAÇÃO */}
                {previewSheetId !== null &&
                  selectedSheetIds.includes(previewSheetId) && (
                    <div className="mt-5 rounded-lg border border-white/10 bg-black/10 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">
                          Pré-visualização
                        </h3>

                        <button
                          type="button"
                          onClick={clearPreview}
                          className="text-xs text-[#C7C7FF] hover:underline"
                        >
                          Fechar
                        </button>
                      </div>

                      {isPreviewLoading && (
                        <p
                          role="status"
                          className="mt-3 flex items-center gap-2 text-sm text-gray-300"
                        >
                          <LoaderCircle
                            size={17}
                            className="animate-spin"
                          />

                          Carregando registros...
                        </p>
                      )}

                      {previewError && (
                        <p
                          role="alert"
                          className="mt-3 text-sm text-red-400"
                        >
                          {previewError}
                        </p>
                      )}

                      {preview && !isPreviewLoading && (
                        <div className="mt-3">
                          <p className="mb-3 text-xs text-[#00D88A]">
                            {preview.sheetName} ·{' '}
                            {preview.rows.length} registros exibidos
                          </p>

                          <div className="max-w-full overflow-x-auto rounded-lg border border-white/10">
                            <table className="w-full min-w-max border-collapse text-left text-xs">
                              <thead className="bg-[#252525]">
                                <tr>
                                  {preview.headers.map(
                                    (header, index) => (
                                      <th
                                        key={index}
                                        scope="col"
                                        className="max-w-[220px] border-b border-white/10 px-3 py-3 font-semibold"
                                      >
                                        {header ||
                                          `Coluna ${index + 1}`}
                                      </th>
                                    )
                                  )}
                                </tr>
                              </thead>

                              <tbody>
                                {preview.rows.map(
                                  (row, rowIndex) => (
                                    <tr
                                      key={rowIndex}
                                      className="border-b border-white/10 last:border-0"
                                    >
                                      {preview.headers.map(
                                        (_, columnIndex) => (
                                          <td
                                            key={columnIndex}
                                            className="max-w-[220px] px-3 py-3 align-top text-gray-300"
                                          >
                                            <div className="max-h-20 overflow-auto break-words">
                                              {row[columnIndex] || '—'}
                                            </div>
                                          </td>
                                        )
                                      )}
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>

                          {preview.rows.length === 0 && (
                            <p className="mt-3 text-xs text-amber-300">
                              Nenhum registro encontrado após o cabeçalho.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                {/* ERROS DE CONVERSÃO */}
                {conversionError && (
                  <p
                    role="alert"
                    className="mt-4 text-sm text-red-400"
                  >
                    {conversionError}
                  </p>
                )}

                {/* NAVEGAÇÃO */}
                <div className="mt-6 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isConverting}
                    onClick={() => {
                      clearPreview()
                      clearConversion()
                      setStep(1)
                    }}
                    className="flex items-center gap-2 rounded-lg border border-white/20 px-4 py-3 text-sm text-white transition hover:bg-white/5 disabled:opacity-50"
                  >
                    <ArrowLeft size={17} aria-hidden="true" />
                    Voltar
                  </button>

                  <button
                    type="button"
                    disabled={
                      selectedSheetIds.length === 0 ||
                      isConverting ||
                      isPreviewLoading
                    }
                    onClick={handleConvert}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#00D88A] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#00C47D] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isConverting ? (
                      <>
                        <LoaderCircle
                          size={17}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                        Convertendo...
                      </>
                    ) : (
                      <>
                        Converter
                        <ArrowRight
                          size={17}
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 3 — RESULTADO */}
            {step === 3 && (
              <div className="mt-7">
                <div className="flex flex-col items-center text-center">
                  <CheckCircle2
                    size={42}
                    className="text-[#00D88A]"
                    aria-hidden="true"
                  />

                  <h2 className="mt-3 text-xl font-semibold">
                    Conversão concluída!
                  </h2>

                  <p className="mt-2 text-sm text-gray-300">
                    {totalConverted} referência(s) convertida(s)
                    {totalRejected > 0 &&
                      ` · ${totalRejected} rejeitada(s)`}
                  </p>
                </div>

                {/* ARQUIVOS GERADOS */}
                <div className="mt-6 space-y-3">
                  {conversionResults.map((result) => (
                    <div
                      key={result.sheetName}
                      className="rounded-lg border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <FileSpreadsheet
                          size={20}
                          className="mt-1 shrink-0 text-[#00D88A]"
                          aria-hidden="true"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-semibold">
                            {result.sheetName}.bib
                          </p>

                          <p className="mt-1 text-xs text-gray-400">
                            {result.converted} convertida(s) ·{' '}
                            {result.rejected} rejeitada(s)
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={result.converted === 0}
                        onClick={() => downloadBib(result)}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#00D88A] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#00C47D] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Download
                          size={17}
                          aria-hidden="true"
                        />
                        Baixar arquivo .bib
                      </button>

                      {result.issues.length > 0 && (
                        <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
                          <p className="text-xs font-medium text-amber-300">
                            {result.issues.length} inconsistência(s)
                          </p>

                          <p className="mt-1 text-xs text-gray-300">
                            Consulte os detalhes no relatório CSV.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* RELATÓRIO DE INCONSISTÊNCIAS */}
                <IssuesReportDownload
                  results={conversionResults}
                />

                {/* NAVEGAÇÃO */}
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      clearConversion()
                      setStep(2)
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-3 text-sm transition hover:bg-white/5"
                  >
                    <ArrowLeft
                      size={17}
                      aria-hidden="true"
                    />
                    Voltar
                  </button>

                  <button
                    type="button"
                    onClick={restart}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#7979F0] px-4 py-3 text-sm font-semibold transition hover:bg-[#6868E0]"
                  >
                    <RotateCcw
                      size={17}
                      aria-hidden="true"
                    />
                    Novo arquivo
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* INFORMAÇÕES SOBRE OS FORMATOS — FORA DO CONVERSOR */}
          <div className="e2b-enter-later mt-4 w-full max-w-xl rounded-lg border border-white/10 bg-[#343434] px-5 py-4 text-center">
            <h2 className="text-sm font-semibold text-white">
              Formatos aceitos
            </h2>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {(['CSV', 'XLSX', 'XLS'] as const).map((format) => (
                <div
                  key={format}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#414141] px-4 py-2 text-sm font-medium"
                >
                  <FileSpreadsheet
                    size={16}
                    className="text-[#00D88A]"
                    aria-hidden="true"
                  />
                  {format}
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-gray-400">
              Até 25 MB por arquivo · Até 5.000 referências por conversão
            </p>
          </div>
        </div>
      </section>

      {/* COLUNA DIREITA — GUIA PRÁTICO */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-[#181818] px-6 py-12 text-center text-white lg:px-10">
        <div className="e2b-enter-delayed w-full max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00D88A]">
            Guia gratuito para estudantes e pesquisadores
          </p>

          <h2 className="mx-auto mt-4 max-w-lg text-2xl font-semibold leading-snug">
            Organize sua revisão sistemática com mais facilidade
          </h2>

          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-gray-300">
            Conheça o Parsif.al e acompanhe cada etapa da sua pesquisa
            com orientações práticas para diferentes áreas do conhecimento.
          </p>

          {/* Mantém a imagem original do projeto, sem alterações. */}
          <img
            src="/images/guia-pratico.png"
            alt="Guia Prático do Parsif.al apresentado em notebook e smartphone"
            className="mx-auto mt-7 w-full max-w-[520px] object-contain transition-transform duration-700 ease-out hover:scale-[1.025]"
          />

          <div className="mx-auto mt-6 grid max-w-lg gap-3 text-left sm:grid-cols-3">
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-4 transition-colors duration-300 hover:border-[#E95AAE]/45 hover:bg-white/[0.065]">
              <h3 className="text-sm font-semibold text-white">
                Planeje sua revisão
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-400">
                Estruture perguntas, critérios e etapas da pesquisa.
              </p>
            </div>

            <div className="rounded-md border border-white/10 bg-white/[0.04] p-4 transition-colors duration-300 hover:border-[#E95AAE]/45 hover:bg-white/[0.065]">
              <h3 className="text-sm font-semibold text-white">
                Organize os estudos
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-400">
                Conheça a seleção e a avaliação de artigos.
              </p>
            </div>

            <div className="rounded-md border border-white/10 bg-white/[0.04] p-4 transition-colors duration-300 hover:border-[#E95AAE]/45 hover:bg-white/[0.065]">
              <h3 className="text-sm font-semibold text-white">
                Acompanhe as etapas
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-400">
                Consulte orientações até a extração de dados.
              </p>
            </div>
          </div>

          <p className="mt-5 text-xs text-gray-400">
            Um material para consultar em cada etapa da sua revisão.
          </p>

          <div className="mt-5">
            <a
              href={`${import.meta.env.BASE_URL}guias/guia-pratico-parsifal.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#00D88A] px-8 py-3 font-semibold text-black transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#00C47D] hover:shadow-[0_8px_24px_rgba(233,90,174,0.18)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00D88A]"
            >
              <Download size={18} aria-hidden="true" />
              Acessar guia em PDF
            </a>
          </div>
        </div>
      </section>

      {/* RODAPÉ — OCUPA TODA A LARGURA DAS DUAS COLUNAS */}
      <footer className="col-span-1 border-t border-white/10 bg-[#171717] px-6 py-9 text-white lg:col-span-2 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-center gap-1.5" aria-hidden="true">
            <span className="h-[2px] w-12 bg-[#00D88A]" />
            <span className="h-[2px] w-6 bg-[#E95AAE]" />
          </div>

          <blockquote className="mx-auto max-w-3xl text-center">
            <p className="text-sm italic leading-relaxed text-gray-300 sm:text-base">
              “A paz de todas as coisas é a tranquilidade da ordem. A ordem é a disposição que atribui a cada coisa, iguais e desiguais, o seu próprio lugar.”
            </p>
            <cite className="mt-2 block text-xs font-medium not-italic tracking-wide text-[#E95AAE]">
              Santo Agostinho — A Cidade de Deus, Livro XIX, capítulo 13
            </cite>
          </blockquote>

          <div className="mt-7 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-5 text-center sm:flex-row sm:text-left">
            <div>
              <p className="text-sm font-semibold tracking-wide">Excel2Bib</p>
              <p className="mt-1 text-xs text-gray-400">
                Ferramenta gratuita para estudantes e pesquisadores
              </p>
            </div>

            <a
              href="https://www.linkedin.com/in/nadianne-galv%C3%A3o-842833148/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn da desenvolvedora — Nadianne Galvão (abre em nova aba)"
              className="inline-flex items-center gap-2 rounded border border-white/15 px-4 py-2.5 text-sm text-gray-200 transition-colors duration-200 hover:border-[#E95AAE]/60 hover:bg-[#E95AAE]/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E95AAE]"
            >
              <span aria-hidden="true" className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-sm bg-[#E95AAE] text-[11px] font-bold leading-none text-[#171717]">in</span>
              LinkedIn - Nadianne Galvão
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}

export default App