import { describe, expect, it } from 'vitest'
import { renderRuleProse, stripLabeledMarkTrack, stripLeadingBoxes } from './renderProse'

describe('renderRuleProse mark shapes', () => {
  it('renders ◇ before uses as circles', () => {
    const html = renderRuleProse('(◇◇◇◇◇ uses): expend a use')
    expect(html).toContain('class="circle"')
    expect(html.match(/class="circle"/g)?.length).toBe(5)
    expect(html).not.toContain('class="box"')
  })

  it('keeps weight ◇ as diamonds next to uses circles', () => {
    const html = renderRuleProse(
      'skins of fine whisky (◇◇ uses), malt, ◇◇ firkins',
    )
    expect(html.match(/class="circle"/g)?.length).toBe(2)
    expect(html.match(/class="box"/g)?.length).toBe(2)
  })

  it('keeps labeled ammo tracks when stripping leading boxes', () => {
    const track = '◇ *a few left* ◇ *out* Any knife or dagger'
    expect(stripLeadingBoxes(track)).toBe(track)
    const html = renderRuleProse(stripLeadingBoxes(track))
    expect(html.match(/class="box"/g)?.length).toBe(2)
  })

  it('strips labeled ammo tracks for the card header UI', () => {
    expect(stripLabeledMarkTrack('◇ *a few left* ◇ *out* Any knife or dagger')).toBe(
      'Any knife or dagger',
    )
  })

  it('still strips plain take-count prefixes', () => {
    expect(stripLeadingBoxes('◇ When you spend an hour')).toBe('When you spend an hour')
    expect(stripLeadingBoxes('◇◇ When you burn with anger')).toBe('When you burn with anger')
  })
})
