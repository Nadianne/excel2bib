
import type {
  BibConversionResult,
} from './convertXlsxToBib'




function escapeCsv(value: string | number): string {
  const text = String(value)


    const safeText = /^[=+\-@]/u.test(text.trimStart())
    ? `'${text}`
    : text

  return `"${safeText.replace(/"/g, '""')}"`
}

export function generateIssuesCsv(
  results: BibConversionResult[]
): string {
  const rows: string[][] = [
    ['Aba', 'Linha', 'Motivo'],
  ]

  for (const result of results) {
    for (const issue of result.issues) {
      rows.push([
        result.sheetName,
        String(issue.row),
        issue.reason,
      ])
    }
  }

  const csv = rows
    .map((row) => row.map(escapeCsv).join(';'))
    .join('\r\n')

  return '\uFEFF' + csv + '\r\n'
}

export function hasConversionIssues(
  results: BibConversionResult[]
): boolean {
  return results.some(
    (result) => result.issues.length > 0
  )
}
