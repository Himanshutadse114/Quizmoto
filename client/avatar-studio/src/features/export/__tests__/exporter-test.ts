import { createAvatar } from '@/features/avatar/avatars'
import { parse } from '@babel/parser'
import {
  avatarDemoFileName,
  createAvatarExportPayload,
  generateJavaScriptAvatarHtml,
  generateJavaScriptAvatarModule,
  generateJavaScriptAvatarPackage,
  generateReactAvatarComponent,
  generateReactAvatarPackage,
  generateReactAvatarRuntime,
} from '@/features/export/exporter'
import { initialExpressions } from '@/features/avatar/presets'
import { createInitialSequences } from '@/features/animation/sequences'

const storedZipFileNames = (archive: Uint8Array) => {
  const names: string[] = []
  const decoder = new TextDecoder()
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)
  let offset = 0

  while (offset + 30 <= archive.byteLength && view.getUint32(offset, true) === 0x04034b50) {
    const contentLength = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const nameStart = offset + 30
    names.push(decoder.decode(archive.subarray(nameStart, nameStart + nameLength)))
    offset = nameStart + nameLength + extraLength + contentLength
  }

  return names
}

describe('avatar export', () => {
  const avatar = createAvatar('Strobi')
  const animations = createInitialSequences().filter(item =>
    ['idle', 'listening'].includes(item.id)
  )
  const payload = createAvatarExportPayload(avatar, initialExpressions, animations)

  it('uses distinct filenames for React and ESM demo archives', () => {
    expect(avatarDemoFileName('Strobi', 'react')).toBe('strobi-avatar-react.zip')
    expect(avatarDemoFileName('Strobi', 'javascript')).toBe('strobi-avatar-esm.zip')
  })

  it('includes only the selected animations and their referenced expressions', () => {
    expect(Object.keys(payload.animations)).toEqual(['idle', 'listening'])
    expect(Object.keys(payload.expressions).sort()).toEqual(
      [
        ...new Set(animations.flatMap(animation => animation.steps.map(step => step.expressionId))),
      ].sort()
    )
    expect(payload).not.toHaveProperty('frames')
    expect(payload.avatar.name).toBe('Strobi')
    expect(payload.avatar.renderStyle).toEqual({ type: 'vector' })
    expect(Object.values(payload.expressions).every(expression => !expression.semanticKey)).toBe(
      true
    )
  })

  it('preserves pixel rendering in standalone exports', () => {
    const pixelPayload = createAvatarExportPayload(
      { ...avatar, renderStyle: { type: 'pixel', resolution: 72 } },
      initialExpressions,
      animations
    )
    const source = generateJavaScriptAvatarModule(pixelPayload)

    expect(pixelPayload.avatar.renderStyle).toEqual({ type: 'pixel', resolution: 72 })
    expect(source).toContain('paintPixelGeometry')
    expect(source).toContain('Math.max(8, Math.min(192')
  })

  it('generates a standalone JavaScript module without a Web Component', () => {
    const source = generateJavaScriptAvatarModule(payload)

    expect(source).toContain('export function createAvatar')
    expect(source).toContain('play(animationName)')
    expect(source).toContain('export const availableAnimations')
    expect(source).toContain('pausedRemainingMs')
    expect(source).toContain('pausedBlinkDelay')
    expect(source).toContain('pausedBlink')
    expect(source).toContain('step.transition')
    expect(source).toContain('stepIndex = 0')
    expect(source).not.toContain('customElements.define')
    expect(source).not.toContain("from '")
    expect(() => parse(source, { sourceType: 'module' })).not.toThrow()
  })

  it('uses the Studio geometry engine to render interpolated transition frames', () => {
    const source = generateJavaScriptAvatarModule(payload)

    expect(source).toContain('AvatarProceduralEngine')
    expect(source).toContain('expressionFields')
    expect(source).toContain('requestAnimationFrame')
    expect(source).not.toContain('avatarFrameIn')
  })

  it('generates an HTML demo that works when opened directly from the filesystem', () => {
    const source = generateJavaScriptAvatarHtml(payload)

    expect(source).not.toContain("import { createAvatar } from './avatar.js'")
    expect(source).toContain('function createAvatar')
    expect(source).toContain('avatar.play("idle")')
  })

  it('generates an interactive playground for the exported animations', () => {
    const source = generateJavaScriptAvatarHtml(payload)

    expect(source).toContain('id="animation-list"')
    expect(source).toContain('id="play-animation"')
    expect(source).toContain('id="pause-animation"')
    expect(source).toContain('id="stop-animation"')
    expect(source).toContain('availableAnimations.forEach')
    expect(source).toContain('avatar.play(activeAnimation)')
    expect(source).toContain('avatar.pause()')
    expect(source).toContain('avatar.stop()')
    expect(source).toContain("createAvatar('#avatar'")
  })

  it('localizes the exported playground', () => {
    const source = generateJavaScriptAvatarHtml(payload, 'fr')

    expect(source).toContain('<html lang="fr">')
    expect(source).toContain('Choisissez une animation exportée')
    expect(source).toContain('▶ Lire')
    expect(source).toContain('En pause')
  })

  it('keeps user-authored names and descriptions inside the generated script', () => {
    const source = generateJavaScriptAvatarHtml({
      ...payload,
      avatar: { ...payload.avatar, name: '</title><script>alert(1)</script>' },
    })

    expect(source).not.toContain('</title><script>alert(1)</script>')
    expect(source).toContain('&lt;/title&gt;')
    expect(source).toContain('\\u003c/script>')
  })

  it('packages the direct-open demo and reusable module together', async () => {
    const archive = new Uint8Array(await generateJavaScriptAvatarPackage(payload).arrayBuffer())
    const contents = new TextDecoder().decode(archive)

    expect(contents).toContain('index.html')
    expect(contents).toContain('avatar.js')
    expect(contents).not.toContain('@bible-strong')
  })

  it('generates a typed React component backed by the local runtime', () => {
    const source = generateReactAvatarComponent(payload)

    expect(source).toContain("from 'react'")
    expect(source).toContain("from './avatar-runtime'")
    expect(source).toContain("from './strobi.avatar'")
    expect(source).toContain('export type { AnimationName }')
    expect(source).toContain('animation?: AnimationName')
    expect(source).toContain('forwardRef<AvatarHandle, AvatarProps>')
    expect(source).not.toContain('AvatarProceduralEngine')
    expect(source).toContain('runtime.createAvatar(host.current')
    expect(source).not.toContain('@ts-nocheck')
    expect(source).not.toContain('avatarFrameIn')
    expect(source).not.toContain("from 'motion")
    expect(() =>
      parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
    ).not.toThrow()
  })

  it('packages the React runtime, avatar data and component separately', async () => {
    const archive = new Uint8Array(await generateReactAvatarPackage(payload).arrayBuffer())
    const contents = new TextDecoder().decode(archive)

    expect(contents).toContain('avatar-runtime.ts')
    expect(contents).toContain('strobi.avatar.ts')
    expect(contents).toContain('Strobi.tsx')
    expect(contents).toContain('strobi.index.ts')
    expect(contents).toContain("from './avatar-runtime'")
    expect(contents).not.toContain('@bible-strong')
  })

  it('generates one avatar-independent and versioned React runtime', () => {
    const runtime = generateReactAvatarRuntime()

    expect(runtime).toContain('AVATAR_RUNTIME_VERSION = 1')
    expect(runtime).toContain('data.version !== AVATAR_RUNTIME_VERSION')
    expect(runtime).not.toContain(payload.avatar.name)
    expect(runtime).toContain('RuntimeAvatar<AnimationName>')
    expect(() => parse(runtime, { sourceType: 'module', plugins: ['typescript'] })).not.toThrow()
  })

  it('uses globally unique SVG identifiers across avatar runtimes', () => {
    const source = generateJavaScriptAvatarModule(payload)

    expect(source).toContain('globalThis.crypto.randomUUID()')
    expect(source).not.toContain('avatarInstanceCount')
  })
})
