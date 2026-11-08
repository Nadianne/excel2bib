
import type JSZip from 'jszip'

export interface FormulaValidationResult {
  valid: boolean
  message: string
}

export async function validateXlsxFormulas(
  zip: JSZip
): Promise<FormulaValidationResult> {
  const worksheets = Object.entries(zip.files).filter(
    ([path, entry]) =>
      !entry.dir &&
      /^xl\/worksheets\/[^/]+\.xml$/i.test(path)
  )

  if (worksheets.length === 0) {
    return {
      valid: false,
      message: 'Nenhuma planilha XML foi encontrada.',
    }
  }

  for (const [path, entry] of worksheets) {
    // Os limites ZIP precisam ter sido verificados antes.
    const xml = await entry.async('string')

    const document = new DOMParser().parseFromString(
      xml,
      'application/xml'
    )

    if (
      document.getElementsByTagName('parsererror').length > 0
    ) {
      return {
        valid: false,
        message: 'Não foi possível interpretar uma das abas.',
      }
    }

    const formulaElements = document.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'f'
    )

    if (formulaElements.length > 0) {
      return {
        valid: false,
        message: `Foram identificadas fórmulas em ${path}.`,
      }
    }
  }

  return {
    valid: true,
    message: 'Nenhuma fórmula encontrada nas abas inspecionadas.',
  }
}
