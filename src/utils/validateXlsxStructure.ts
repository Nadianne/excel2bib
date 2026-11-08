import JSZip from 'jszip'
import { validateZipLimits } from './validateZipLimits'
import { validateXlsxFormulas } from './validateXlsxFormulas'

export interface XlsxValidationResult {
  valid: boolean
  message: string
}

export async function validateXlsxStructure(
  file: File
): Promise<XlsxValidationResult> {
  try {
    // 1. Carrega a estrutura do pacote ZIP.
    const zip = await JSZip.loadAsync(file, {
      checkCRC32: false,
    })

    // 2. Verifica os limites declarados no ZIP.
    const zipValidation = await validateZipLimits(zip)

    if (!zipValidation.valid) {
      return {
        valid: false,
        message: zipValidation.message,
      }
    }

    // 3. Obtém os nomes dos componentes internos.
    const entries = Object.keys(zip.files)

    // 4. Verifica os componentes básicos do XLSX.
    const requiredFiles = [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
    ]

    for (const path of requiredFiles) {
      if (!zip.file(path)) {
        return {
          valid: false,
          message: `Estrutura XLSX inválida: componente obrigatório ausente (${path}).`,
        }
      }
    }

    // 5. Rejeita componentes não permitidos.
    const forbiddenPatterns = [
      /(^|\/)vbaProject\.bin$/i,
      /(^|\/)macrosheets\//i,
      /(^|\/)externalLinks\//i,
      /(^|\/)embeddings\//i,
      /(^|\/)activeX\//i,
    ]

    const forbiddenEntry = entries.find((path) =>
      forbiddenPatterns.some((pattern) => pattern.test(path))
    )

    if (forbiddenEntry) {
      return {
        valid: false,
        message: 'A planilha contém componentes não permitidos.',
      }
    }

    // 6. Confirma a existência de uma planilha.
    const hasWorksheet = entries.some((path) =>
      /^xl\/worksheets\/sheet\d+\.xml$/i.test(path)
    )

    if (!hasWorksheet) {
      return {
        valid: false,
        message: 'Nenhuma planilha foi encontrada no arquivo XLSX.',
      }
    }

 
    // 7. Verifica se existem fórmulas nas abas.
    const formulaValidation = await validateXlsxFormulas(zip)

    if (!formulaValidation.valid) {
      return {
        valid: false,
        message: formulaValidation.message,
      }
    }

    // 8. Resultado preliminar da validação.
    return {
      valid: true,
      message: 'Estrutura básica verificada e nenhuma fórmula encontrada.',
    }

  } catch {
    return {
      valid: false,
      message: 'Não foi possível interpretar a estrutura do arquivo XLSX.',
    }
  }
}
