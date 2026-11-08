
import type JSZip from 'jszip'

const MAX_ENTRIES = 1000
const MAX_TOTAL_SIZE = 100 * 1024 * 1024
const MAX_ENTRY_SIZE = 40 * 1024 * 1024
const MAX_RATIO = 200

export interface ZipValidationResult {
  valid: boolean
  message: string
}

interface ZipEntryMetadata {
  compressedSize?: number
  uncompressedSize?: number
}

type ZipEntryWithMetadata = JSZip.JSZipObject & {
  _data?: ZipEntryMetadata
}

// Interface local para o método interno do JSZip.
interface InternalStream {
  on(
    event: 'data',
    callback: (chunk: Uint8Array) => void
  ): unknown
  on(
    event: 'error' | 'end',
    callback: () => void
  ): unknown
  pause(): void
  resume(): void
}

type ZipEntryWithStream = JSZip.JSZipObject & {
  internalStream(type: 'uint8array'): InternalStream
}

function invalid(message: string): ZipValidationResult {
  return {
    valid: false,
    message,
  }
}

// Conta os bytes produzidos pela descompactação,
// sem acumular o conteúdo completo em uma variável.
function checkExpandedEntry(
  entry: JSZip.JSZipObject,
  remainingTotal: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    let expandedSize = 0
    let settled = false

    const streamableEntry = entry as ZipEntryWithStream
    const stream = streamableEntry.internalStream('uint8array')

    stream.on('data', (chunk: Uint8Array) => {
      if (settled) return

      expandedSize += chunk.byteLength

      if (expandedSize > MAX_ENTRY_SIZE) {
        settled = true
        stream.pause()

        reject(
          new Error(
            'O arquivo contém um componente interno muito grande.'
          )
        )
        return
      }

      if (expandedSize > remainingTotal) {
        settled = true
        stream.pause()

        reject(
          new Error(
            'O conteúdo descompactado ultrapassa 100 MB.'
          )
        )
      }
    })

    stream.on('error', () => {
      if (settled) return

      settled = true

      reject(
        new Error(
          'Não foi possível descompactar um componente da planilha.'
        )
      )
    })

    stream.on('end', () => {
      if (settled) return

      settled = true
      resolve(expandedSize)
    })

    stream.resume()
  })
}

export async function validateZipLimits(
  zip: JSZip
): Promise<ZipValidationResult> {
  const entries = Object.values(zip.files)

  if (entries.length > MAX_ENTRIES) {
    return invalid(
      'O arquivo possui entradas internas demais.'
    )
  }

  const seenPaths = new Set<string>()
  let declaredTotal = 0

  // Primeira passagem: verifica nomes e metadados.
  for (const entry of entries) {
    const path = entry.name

    if (
      !path ||
      path.startsWith('/') ||
      path.includes('\\') ||
      path.includes('\0') ||
      path.split('/').some((part) => part === '..')
    ) {
      return invalid(
        'O arquivo contém caminhos internos não permitidos.'
      )
    }

    const normalizedPath = path
      .normalize('NFC')
      .toLowerCase()

    if (seenPaths.has(normalizedPath)) {
      return invalid(
        'O arquivo contém nomes internos conflitantes.'
      )
    }

    seenPaths.add(normalizedPath)

    if (entry.dir) continue

    // Verificação preliminar com metadados internos.
    const metadata = (entry as ZipEntryWithMetadata)._data

    const compressed = metadata?.compressedSize
    const uncompressed = metadata?.uncompressedSize

    if (
      compressed === undefined ||
      uncompressed === undefined ||
      !Number.isSafeInteger(compressed) ||
      !Number.isSafeInteger(uncompressed) ||
      compressed < 0 ||
      uncompressed < 0
    ) {
      return invalid(
        'Não foi possível verificar os tamanhos internos.'
      )
    }

    if (uncompressed > MAX_ENTRY_SIZE) {
      return invalid(
        'O arquivo contém um componente interno muito grande.'
      )
    }

    declaredTotal += uncompressed

    if (declaredTotal > MAX_TOTAL_SIZE) {
      return invalid(
        'O conteúdo declarado ultrapassa 100 MB.'
      )
    }

    if (
      (compressed === 0 && uncompressed > 0) ||
      (compressed > 0 &&
        uncompressed / compressed > MAX_RATIO)
    ) {
      return invalid(
        'O arquivo apresenta compactação excessiva.'
      )
    }
  }

  // Segunda passagem: conta os bytes descompactados.
  let expandedTotal = 0

  try {
    for (const entry of entries) {
      if (entry.dir) continue

      const remainingTotal =
        MAX_TOTAL_SIZE - expandedTotal

      const expandedSize = await checkExpandedEntry(
        entry,
        remainingTotal
      )

      expandedTotal += expandedSize
    }
  } catch (error) {
    return invalid(
      error instanceof Error
        ? error.message
        : 'Não foi possível verificar o conteúdo descompactado.'
    )
  }

  return {
    valid: true,
    message:
      'Conteúdo descompactado dentro dos limites definidos.',
  }
}
