export type AvatarReaction = 'happy' | 'upset' | 'angry' | 'scared'

export type ReactionPointerSample = {
  x: number
  y: number
  time: number
}

export type ReactionWheelSample = {
  direction: -1 | 1
  time: number
}

const GESTURE_WINDOW_MS = 1_100
const SAMPLE_DISTANCE = 6
const REQUIRED_REVERSALS = 2

const analyzeAxis = (
  samples: readonly ReactionPointerSample[],
  axis: 'horizontal' | 'vertical'
) => {
  let travel = 0
  let reversals = 0
  let previousDirection = 0

  for (let index = 1; index < samples.length; index += 1) {
    const deltaX = samples[index].x - samples[index - 1].x
    const deltaY = samples[index].y - samples[index - 1].y
    const primary = axis === 'horizontal' ? deltaX : deltaY
    const secondary = axis === 'horizontal' ? deltaY : deltaX
    if (Math.abs(primary) < SAMPLE_DISTANCE || Math.abs(primary) < Math.abs(secondary) * 1.25) {
      continue
    }
    const direction = Math.sign(primary)
    travel += Math.abs(primary)
    if (previousDirection !== 0 && direction !== previousDirection) reversals += 1
    previousDirection = direction
  }

  return { travel, reversals }
}

export const detectDirectionalReaction = (
  samples: readonly ReactionPointerSample[]
): AvatarReaction | null => {
  if (samples.length < 5) return null
  const horizontal = analyzeAxis(samples, 'horizontal')
  const vertical = analyzeAxis(samples, 'vertical')
  const horizontalReady = horizontal.reversals >= REQUIRED_REVERSALS && horizontal.travel >= 80
  const verticalReady = vertical.reversals >= REQUIRED_REVERSALS && vertical.travel >= 75

  if (horizontalReady && (!verticalReady || horizontal.travel >= vertical.travel)) return 'happy'
  if (verticalReady) return 'scared'
  return null
}

export const appendReactionPointerSample = (
  samples: readonly ReactionPointerSample[],
  sample: ReactionPointerSample
) => {
  const recent = samples.filter(item => sample.time - item.time <= GESTURE_WINDOW_MS)
  const previous = recent.at(-1)
  if (previous && Math.hypot(sample.x - previous.x, sample.y - previous.y) < SAMPLE_DISTANCE) {
    return recent
  }
  return [...recent, sample].slice(-24)
}

export const registerReactionTap = (tapTimes: readonly number[], time: number) => {
  const recent = [...tapTimes.filter(item => time - item <= 850), time]
  return {
    tapTimes: recent.length >= 3 ? [] : recent,
    reaction: recent.length >= 3 ? ('angry' as const) : null,
  }
}

export const registerReactionWheel = (
  samples: readonly ReactionWheelSample[],
  deltaY: number,
  time: number
) => {
  if (Math.abs(deltaY) < 1) return { samples: [...samples], reaction: null }
  const direction = Math.sign(deltaY) as -1 | 1
  const recent = samples.filter(item => time - item.time <= 1_200)
  if (recent.at(-1)?.direction !== direction) recent.push({ direction, time })
  const reaction = recent.length >= 3 ? ('angry' as const) : null
  return { samples: reaction ? [] : recent, reaction }
}

export const isUpsetLongPress = (durationMs: number, movement: number) =>
  durationMs >= 700 && movement <= 14

export const isUpsetDeparture = (dwellMs: number) => dwellMs >= 1_600

export const reactionSemanticKeys: Record<AvatarReaction, readonly string[]> = {
  happy: ['joyful-wide', 'playful-right', 'joyful-down-right', 'gentle-downward-gaze'],
  upset: ['shy-downward', 'sleepy-squint', 'eyes-closed', 'drowsy-closed'],
  angry: ['angry-right', 'angry-left'],
  scared: ['surprised-wide-left', 'surprised-left'],
}
