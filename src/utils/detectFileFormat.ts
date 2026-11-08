
export type FileFormat = 'xlsx' | 'xls' | 'csv' | 'unknown'

export async function detectFileFormat(
  file: File
): Promise<FileFormat> {
  const buffer = await file.slice(0, 8).arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // XLSX utiliza um contêiner ZIP.
  // Essa assinatura não comprova que o ZIP seja um XLSX.
  const isZip =
    bytes[0] === 0x50 &&
    bytes[1] === 0x4B &&
    (
      (bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06)
    )

  if (isZip) {
    return 'xlsx'
  }

  // XLS legado utiliza o contêiner OLE.
  const xlsSignature = [
    0xD0, 0xCF, 0x11, 0xE0,
    0xA1, 0xB1, 0x1A, 0xE1
  ]

  const isOle = xlsSignature.every(
    (value, index) => bytes[index] === value
  )

  if (isOle) {
    return 'xls'
  }

  // CSV não possui assinatura binária obrigatória.
  // Classificação provisória pela extensão.
  if (file.name.toLowerCase().endsWith('.csv')) {
    return 'csv'
  }

  return 'unknown'
}
