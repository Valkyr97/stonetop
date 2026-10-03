import { describe, expect, it } from 'vitest'
import { parseTrackerLabel, trackerDisplayTitle } from './trackers'

describe('parseTrackerLabel', () => {
  it('splits ammo into per-mark labels like the book', () => {
    expect(parseTrackerLabel('ammo: a few left / out')).toEqual({
      title: null,
      markLabels: ['a few left', 'out'],
    })
  })

  it('omits generic uses labels', () => {
    expect(parseTrackerLabel('uses')).toEqual({ title: null, markLabels: [] })
    expect(parseTrackerLabel('use')).toEqual({ title: null, markLabels: [] })
  })

  it('keeps named tracks as a group title', () => {
    expect(parseTrackerLabel('Nerve')).toEqual({ title: 'Nerve', markLabels: [] })
    expect(parseTrackerLabel('Blessing')).toEqual({ title: 'Blessing', markLabels: [] })
  })
})

describe('trackerDisplayTitle', () => {
  it('returns null when the label is a per-mark ammo track', () => {
    expect(trackerDisplayTitle('ammo: a few left / out')).toBeNull()
  })

  it('omits generic uses labels', () => {
    expect(trackerDisplayTitle('uses')).toBeNull()
    expect(trackerDisplayTitle('use')).toBeNull()
  })

  it('keeps named tracks', () => {
    expect(trackerDisplayTitle('Nerve')).toBe('Nerve')
    expect(trackerDisplayTitle('Blessing')).toBe('Blessing')
  })
})
