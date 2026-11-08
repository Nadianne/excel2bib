
import { Download, FileWarning } from 'lucide-react'

import {
  generateIssuesCsv,
  hasConversionIssues,
} from '../utils/generateIssuesCsv'

import type {
  BibConversionResult,
} from '../utils/convertXlsxToBib'

interface IssuesReportDownloadProps {
  results: BibConversionResult[]
}

export function IssuesReportDownload({
  results,
}: IssuesReportDownloadProps) {
  if (!hasConversionIssues(results)) {
    return null
  }

  const totalIssues = results.reduce(
    (total, result) => total + result.issues.length,
    0
  )

  function handleDownload() {
    const csv = generateIssuesCsv(results)

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = 'excel2bib_inconsistencias.csv'

    document.body.appendChild(link)
    link.click()
    link.remove()

    window.setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 1000)
  }

  return (
    <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
      <div className="flex items-start gap-3">
        <FileWarning
          size={20}
          className="shrink-0 text-amber-300"
          aria-hidden="true"
        />

        <div>
          <h3 className="text-sm font-semibold text-white">
            Inconsistências encontradas
          </h3>

          <p className="mt-1 text-xs text-gray-300">
            {totalIssues} registro(s) rejeitado(s).
            Consulte as linhas e os motivos no relatório.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownload}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300/40 px-4 py-3 text-sm font-medium text-white transition hover:bg-amber-300/10"
      >
        <Download size={17} aria-hidden="true" />
        Baixar relatório de inconsistências (.csv)
      </button>
    </div>
  )
}
