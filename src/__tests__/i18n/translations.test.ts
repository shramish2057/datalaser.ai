import { describe, it, expect } from 'vitest'
import en from '@/messages/en.json'
import de from '@/messages/de.json'

type NestedRecord = Record<string, string | NestedRecord>

function getKeys(obj: NestedRecord, prefix = ''): string[] {
  const keys: string[] = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const value = obj[key]
    if (typeof value === 'object' && value !== null) {
      keys.push(...getKeys(value as NestedRecord, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

function getValues(obj: NestedRecord, prefix = ''): { key: string; value: string }[] {
  const entries: { key: string; value: string }[] = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const value = obj[key]
    if (typeof value === 'object' && value !== null) {
      entries.push(...getValues(value as NestedRecord, fullKey))
    } else {
      entries.push({ key: fullKey, value: value as string })
    }
  }
  return entries
}

describe('i18n translation files', () => {
  const enKeys = getKeys(en as unknown as NestedRecord)
  const deKeys = getKeys(de as unknown as NestedRecord)

  it('every key in en.json exists in de.json', () => {
    const deKeySet = new Set(deKeys)
    const missing = enKeys.filter((k) => !deKeySet.has(k))
    expect(missing).toEqual([])
  })

  it('every key in de.json exists in en.json', () => {
    const enKeySet = new Set(enKeys)
    const missing = deKeys.filter((k) => !enKeySet.has(k))
    expect(missing).toEqual([])
  })

  it('total key count matches', () => {
    expect(enKeys.length).toBe(deKeys.length)
  })

  it('no empty string values in en.json', () => {
    const enValues = getValues(en as unknown as NestedRecord)
    const empty = enValues.filter((e) => e.value === '')
    expect(empty).toEqual([])
  })

  it('no empty string values in de.json', () => {
    const deValues = getValues(de as unknown as NestedRecord)
    const empty = deValues.filter((e) => e.value === '')
    expect(empty).toEqual([])
  })

  it('no values containing "TODO" in en.json', () => {
    const enValues = getValues(en as unknown as NestedRecord)
    const todos = enValues.filter((e) => e.value.includes('TODO'))
    expect(todos).toEqual([])
  })

  it('no values containing "TODO" in de.json', () => {
    const deValues = getValues(de as unknown as NestedRecord)
    const todos = deValues.filter((e) => e.value.includes('TODO'))
    expect(todos).toEqual([])
  })

  it('no em dashes in en.json values', () => {
    const enValues = getValues(en as unknown as NestedRecord)
    const withEmDash = enValues.filter((e) => e.value.includes('\u2014'))
    expect(withEmDash).toEqual([])
  })

  it('no em dashes in de.json values', () => {
    const deValues = getValues(de as unknown as NestedRecord)
    const withEmDash = deValues.filter((e) => e.value.includes('\u2014'))
    expect(withEmDash).toEqual([])
  })
})
