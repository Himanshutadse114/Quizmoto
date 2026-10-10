import { describe, expect, it } from 'vitest'

import {
  appendReactionPointerSample,
  detectDirectionalReaction,
  isUpsetDeparture,
  isUpsetLongPress,
  registerReactionTap,
  type ReactionPointerSample,
} from '@/features/avatar/avatarReactions'

const samples = (points: Array<[number, number]>): ReactionPointerSample[] =>
  points.map(([x, y], index) => ({ x, y, time: index * 120 }))

describe('avatar reactions', () => {
  it('recognizes a deliberate left-right wiggle as happy', () => {
    expect(
      detectDirectionalReaction(
        samples([
          [0, 0],
          [42, 2],
          [-38, 1],
          [46, -2],
          [-44, 0],
        ])
      )
    ).toBe('happy')
  })

  it('recognizes a deliberate vertical shake as scared', () => {
    expect(
      detectDirectionalReaction(
        samples([
          [0, 0],
          [1, 36],
          [-1, -34],
          [2, 40],
          [0, -38],
        ])
      )
    ).toBe('scared')
  })

  it('does not react to ordinary diagonal pointer travel', () => {
    expect(
      detectDirectionalReaction(
        samples([
          [0, 0],
          [20, 18],
          [40, 36],
          [60, 54],
          [80, 72],
        ])
      )
    ).toBeNull()
  })

  it('keeps only recent, meaningful pointer samples', () => {
    const initial = [{ x: 0, y: 0, time: 0 }]
    expect(appendReactionPointerSample(initial, { x: 2, y: 1, time: 100 })).toEqual(initial)
    expect(appendReactionPointerSample(initial, { x: 20, y: 0, time: 1_200 })).toEqual([
      { x: 20, y: 0, time: 1_200 },
    ])
  })

  it('maps three quick taps to angry and deliberate waiting to upset', () => {
    const first = registerReactionTap([], 0)
    const second = registerReactionTap(first.tapTimes, 250)
    const third = registerReactionTap(second.tapTimes, 500)
    expect(third.reaction).toBe('angry')
    expect(isUpsetLongPress(760, 5)).toBe(true)
    expect(isUpsetLongPress(760, 30)).toBe(false)
    expect(isUpsetDeparture(1_700)).toBe(true)
  })
})
