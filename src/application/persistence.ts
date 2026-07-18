import type { EventBatch } from '@/core/model/contracts'
import { ContentVersionMismatch } from '@/core/model/errors'

export interface SaveDocument {
  readonly format: 'douluo-spin-event-log'
  readonly schemaVersion: 3
  readonly contentVersion: string
  readonly batches: readonly EventBatch[]
  readonly checksum: string
}

function checksum(value: string): string {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193)
  }
  return (result >>> 0).toString(16).padStart(8, '0')
}

function payload(contentVersion: string, batches: readonly EventBatch[]): string {
  return JSON.stringify({ schemaVersion: 3, contentVersion, batches })
}

export function createSaveDocument(contentVersion: string, batches: readonly EventBatch[]): SaveDocument {
  const cloned = structuredClone(batches)
  return {
    format: 'douluo-spin-event-log',
    schemaVersion: 3,
    contentVersion,
    batches: cloned,
    checksum: checksum(payload(contentVersion, cloned)),
  }
}

export function serializeSave(contentVersion: string, batches: readonly EventBatch[]): string {
  return JSON.stringify(createSaveDocument(contentVersion, batches), null, 2)
}

export function parseSave(value: string, expectedContentVersion: string): SaveDocument {
  const parsed = JSON.parse(value) as Partial<SaveDocument>
  if (parsed.format !== 'douluo-spin-event-log' || parsed.schemaVersion !== 3 || !Array.isArray(parsed.batches) || typeof parsed.contentVersion !== 'string') {
    throw new TypeError('Invalid v0.3 save document')
  }
  if (parsed.contentVersion !== expectedContentVersion) throw new ContentVersionMismatch(expectedContentVersion, parsed.contentVersion)
  const expected = checksum(payload(parsed.contentVersion, parsed.batches))
  if (parsed.checksum !== expected) throw new TypeError('Save checksum mismatch')
  return parsed as SaveDocument
}
