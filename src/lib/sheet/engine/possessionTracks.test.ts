import { describe, expect, it } from 'vitest'
import { possessionUseTrack } from './possessionTracks'

describe('possessionUseTrack', () => {
  it('lifts Ranger composite-bow ammo from mid-prose', () => {
    const track = possessionUseTrack({
      rule_text: '(*far*, +1 damage, *x* piercing;\n\n◇ low ammo, all out)◇',
    })
    expect(track.markLabels).toEqual(['low ammo', 'all out'])
    expect(track.boxes).toBe(2)
    expect(track.prose).toBe('(*far*, +1 damage, *x* piercing)')
    expect(track.prose).not.toMatch(/low ammo|all out|◇/)
  })

  it('lifts leading (◇◇◇ uses) without treating later nested uses as the track', () => {
    const track = possessionUseTrack({
      rule_text: '(◇◇◇ uses): expend a use to have a well-stocked, safe shelter nearby; GM can veto.',
    })
    expect(track.boxes).toBe(3)
    expect(track.markLabels).toEqual([])
    expect(track.prose).toMatch(/^expend a use/)
    expect(track.prose).not.toMatch(/◇/)
  })

  it('does not steal nested whisky uses from Distillery-style blurbs', () => {
    const track = possessionUseTrack({
      rule_text:
        ': skins of fine whisky (◇◇ uses, grants advantage to Persuade), copper tubes, malt, ◇◇ firkins',
    })
    expect(track.boxes).toBe(0)
    expect(track.prose).toContain('whisky')
  })

  it('prefers pack usesMax when prose has no leading uses track', () => {
    const track = possessionUseTrack({
      usesMax: 3,
      rule_text: 'A quiet place in the woods.',
    })
    expect(track.boxes).toBe(3)
    expect(track.prose).toBe('A quiet place in the woods.')
  })
})
