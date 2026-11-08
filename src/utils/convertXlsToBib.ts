
import Papa from 'papaparse'

import { readXls } from './readXls'
import { convertCsvToBib } from './convertCsvToBib'

import type { BibConversionResult } from './convertXlsxToBib'

export async function convertXlsToBib(
  file: File,
  sheetName: string
): Promise<BibConversionResult> {
  // Reutiliza o leitor XLS, incluindo suas
  // verificações preliminares de fórmulas.
  const workbook = await readXls(file)

  const sheet = workbook.data.find(
    (item) => item.sheetName === sheetName
  )

  if (!sheet) {
    throw new Error(
      `A aba "${sheetName}" não foi encontrada no XLS.`
    )
  }

  if (sheet.headers.length === 0) {
    throw new Error(
      `A aba "${sheetName}" não possui cabeçalhos.`
    )
  }

  // Adaptador temporário: transforma os dados
  // já lidos em CSV local, sem enviar a servidor.
  const csvContent = Papa.unparse(
    [sheet.headers, ...sheet.rows],
    {
      delimiter: ';',
      newline: '\r\n',
      quotes: true,
    }
  )

  const csvFile = new File(
    [csvContent],
    `${sheetName}.csv`,
    { type: 'text/csv;charset=utf-8' }
  )

  // Reaproveita as regras bibliográficas
  // já utilizadas na conversão CSV.
  const result = await convertCsvToBib(csvFile, {
    encoding: 'utf-8',
    delimiter: ';',
  })

  return {
    ...result,
    sheetName,
  }
}
