import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'

import LegalEdit from './[slug].vue'

/**
 * Editing one legal page: versions on the left, the editor on the right. Two
 * things must not go wrong — an edit is never lost without asking, and nothing
 * goes live by accident (a second click, and a third with open placeholders).
 */
interface Version {
  id: number
  versionNo: number
  note: string
  createdBy: string
  createdAt: string
  live: boolean
  placeholders: number
  bodyMd: string
}

const V1: Version = {
  id: 1,
  versionNo: 1,
  note: '',
  createdBy: 'system',
  createdAt: '2026-10-01T08:00:00Z',
  live: true,
  placeholders: 0,
  bodyMd: '## Alt\n\nalter Text',
}
const V2: Version = {
  ...V1,
  id: 2,
  versionNo: 2,
  note: 'Vorschlag',
  live: false,
  placeholders: 2,
  bodyMd: '## Neu\n\n[[Hoster]] [[Frist]]',
}
const V3: Version = {
  ...V1,
  id: 3,
  versionNo: 3,
  note: 'n',
  createdBy: 'admin',
  live: false,
  bodyMd: 'gespeichert',
}

let versions: Version[] = []
let detailFails: number | null = null
let saveFails: string | null = null
let activateFails: string | null = null
const saved: unknown[] = []
const activated: number[] = []

registerEndpoint('/admin/api/legal/datenschutz', () => ({
  slug: 'datenschutz',
  title: 'Datenschutzerklärung',
  versions: versions.map(({ bodyMd: _bodyMd, ...summary }) => summary),
}))
registerEndpoint('/admin/api/legal/agb', () => {
  throw createError({ statusCode: 500 })
})
registerEndpoint('/admin/api/legal/blog', () => {
  throw createError({ statusCode: 404, statusMessage: 'Unbekannte Seite' })
})
function versionDetail(v: Version) {
  if (detailFails === v.id) throw createError({ statusCode: 500, statusMessage: 'DB weg' })
  return versions.find((x) => x.id === v.id) ?? v
}

function activateVersion(v: Version) {
  if (activateFails) throw createError({ statusCode: 500, statusMessage: activateFails })
  activated.push(v.id)
  versions = versions.map((x) => ({ ...x, live: x.id === v.id }))
  return { ok: true }
}

for (const v of [V1, V2, V3]) {
  registerEndpoint(`/admin/api/legal/datenschutz/versions/${v.id}`, () => versionDetail(v))
  registerEndpoint(`/admin/api/legal/datenschutz/versions/${v.id}/activate`, {
    method: 'POST',
    handler: () => activateVersion(v),
  })
}
registerEndpoint('/admin/api/legal/datenschutz/versions', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody<{ bodyMd: string; note: string }>(event)
    saved.push(body)
    if (saveFails) throw createError({ statusCode: 409, statusMessage: saveFails })
    versions = [{ ...V3, bodyMd: body.bodyMd, note: body.note }, ...versions]
    return { id: 3, versionNo: 3, placeholders: [] }
  },
})
registerEndpoint('/admin/api/legal/preview', {
  method: 'POST',
  handler: async (event) => {
    const { bodyMd } = await readBody<{ bodyMd: string }>(event)
    return {
      html: `<p>${bodyMd}</p>`,
      placeholders: [...bodyMd.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]),
    }
  },
})

let unmount: (() => void) | null = null

beforeEach(() => {
  versions = [V2, V1]
  detailFails = null
  saveFails = null
  activateFails = null
  saved.length = 0
  activated.length = 0
  clearNuxtData()
})

afterEach(() => {
  unmount?.()
  unmount = null
  vi.restoreAllMocks()
})

/** happy-dom has no window.confirm; the page asks it before dropping an edit. */
function stubConfirm(answer: boolean) {
  const confirm = vi.fn<(message: string) => boolean>(() => answer)
  Object.defineProperty(window, 'confirm', { value: confirm, configurable: true, writable: true })
  return confirm
}

async function mount(slug = 'datenschutz') {
  const wrapper = await mountSuspended(LegalEdit, { route: `/admin/legal/${slug}` })
  unmount = () => {
    wrapper.unmount()
  }
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mount>>

const editor = (w: Wrapper) => w.get('textarea')
const versionButton = (w: Wrapper, no: number) =>
  w.findAll('[data-testid="versions"] li > button').find((b) => b.text().startsWith(`v${no}`))!

async function loaded(w: Wrapper, bodyMd: string) {
  await vi.waitFor(() => {
    expect(editor(w).element.value).toBe(bodyMd)
  })
}

describe('admin legal editor', () => {
  it('lists the versions and opens the newest in the editor', async () => {
    const w = await mount()
    await loaded(w, V2.bodyMd)

    const items = w.findAll('[data-testid="versions"] li')
    expect(items[0].text()).toContain('v2')
    expect(items[0].text()).toContain('2 [[…]]')
    expect(items[0].text()).toContain('Vorschlag')
    expect(items[1].text()).toContain('live')
    // Only versions that are not live can be put live.
    expect(w.find('[data-testid="activate-2"]').exists()).toBe(true)
    expect(w.find('[data-testid="activate-1"]').exists()).toBe(false)
    expect(w.text()).toContain('Neue Version auf Basis von v2')
    expect(w.get('a[target="_blank"]').attributes('href')).toBe('/datenschutz')
  })

  it('lists the open placeholders of the text in the editor', async () => {
    const w = await mount()
    await loaded(w, V2.bodyMd)

    await vi.waitFor(() => {
      expect(w.get('[data-testid="open-placeholders"]').text()).toBe(
        'Offene Platzhalter: Hoster · Frist',
      )
    })
  })

  it('starts empty for a page without versions', async () => {
    versions = []

    const w = await mount()

    expect(w.text()).toContain('Noch keine Version gespeichert.')
    expect(w.get('h3 + *').exists()).toBe(true)
    expect(w.text()).toContain('Neue Version')
    expect(w.text()).not.toContain('auf Basis von')
    expect(w.get('[data-testid="save"]').attributes('disabled')).toBeDefined()
  })

  it('shows a version without a note without an empty line for it', async () => {
    const w = await mount()
    await loaded(w, V2.bodyMd)

    expect(
      w.findAll('[data-testid="versions"] li')[1].findAll('[data-testid="version-note"]'),
    ).toHaveLength(0)
  })

  it('falls back to the raw error when the server sends no message', async () => {
    const w = await mount('agb')

    expect(w.text()).toMatch(/Fehler beim Laden: .+/)
  })

  it('reports an unknown page', async () => {
    const w = await mount('blog')

    expect(w.text()).toContain('Unbekannte Seite')
    expect(w.text()).toContain('Fehler beim Laden')
  })

  describe('switching versions', () => {
    it('loads another version into the editor', async () => {
      const w = await mount()
      await loaded(w, V2.bodyMd)

      await versionButton(w, 1).trigger('click')

      await loaded(w, V1.bodyMd)
      expect(w.text()).toContain('auf Basis von v1')
    })

    it('does nothing when the open version is clicked again', async () => {
      const w = await mount()
      await loaded(w, V2.bodyMd)
      await editor(w).setValue('geändert')
      const confirm = stubConfirm(true)

      await versionButton(w, 2).trigger('click')

      expect(confirm).not.toHaveBeenCalled()
      expect(editor(w).element.value).toBe('geändert')
    })

    it('keeps unsaved changes unless the operator agrees to drop them', async () => {
      const w = await mount()
      await loaded(w, V2.bodyMd)
      await editor(w).setValue('geändert')
      expect(w.text()).toContain('ungespeichert')
      const confirm = stubConfirm(false)

      await versionButton(w, 1).trigger('click')

      expect(confirm).toHaveBeenCalledWith('Ungespeicherte Änderungen verwerfen?')
      expect(editor(w).element.value).toBe('geändert')

      confirm.mockReturnValue(true)
      await versionButton(w, 1).trigger('click')
      await loaded(w, V1.bodyMd)
    })

    it('reports a version that cannot be loaded', async () => {
      const w = await mount()
      await loaded(w, V2.bodyMd)
      detailFails = 1

      await versionButton(w, 1).trigger('click')

      await vi.waitFor(() => {
        expect(w.get('[role="status"]').text()).toBe('Version konnte nicht geladen werden: DB weg')
      })
      expect(editor(w).element.value).toBe(V2.bodyMd)
    })
  })

  describe('saving', () => {
    it('stores the edit as a new version and opens it', async () => {
      const w = await mount()
      await loaded(w, V2.bodyMd)
      expect(w.get('[data-testid="save"]').attributes('disabled')).toBeDefined()

      await editor(w).setValue('gespeichert')
      await w.get('input[type="text"]').setValue('Hoster ergänzt')
      await w.get('[data-testid="save"]').trigger('click')

      await vi.waitFor(() => {
        expect(w.get('[role="status"]').text()).toBe(
          'Version v3 gespeichert. Sie ist noch nicht live.',
        )
      })
      expect(saved).toStrictEqual([{ bodyMd: 'gespeichert', note: 'Hoster ergänzt' }])
      await vi.waitFor(() => {
        expect(w.text()).toContain('auf Basis von v3')
      })
      expect(w.findAll('[data-testid="versions"] li')).toHaveLength(3)
      expect(w.text()).not.toContain('ungespeichert')
    })

    it('reports a failed save and keeps the text', async () => {
      saveFails = 'Gleichzeitig wurde eine andere Version gespeichert'
      const w = await mount()
      await loaded(w, V2.bodyMd)

      await editor(w).setValue('mein Text')
      await w.get('[data-testid="save"]').trigger('click')

      await vi.waitFor(() => {
        expect(w.get('[role="status"]').text()).toBe(
          'Speichern fehlgeschlagen: Gleichzeitig wurde eine andere Version gespeichert',
        )
      })
      expect(w.get('[role="status"]').classes()).toContain('bg-red-50')
      expect(editor(w).element.value).toBe('mein Text')
    })
  })

  describe('going live', () => {
    it('asks first, then puts the version live in both shops', async () => {
      versions = [{ ...V2, placeholders: 0 }, V1]
      const w = await mount()
      await loaded(w, V2.bodyMd)

      await w.get('[data-testid="activate-2"]').trigger('click')
      expect(activated).toStrictEqual([])
      expect(w.get('[data-testid="activate-confirm"]').text()).toContain(
        'Version v2 live schalten?',
      )

      await w.get('[data-testid="activate-yes"]').trigger('click')

      await vi.waitFor(() => {
        expect(w.get('[role="status"]').text()).toBe(
          'Version v2 ist jetzt live – im neuen Shop und im Altshop.',
        )
      })
      expect(activated).toStrictEqual([2])
      expect(w.find('[data-testid="activate-confirm"]').exists()).toBe(false)
      await vi.waitFor(() => {
        expect(w.find('[data-testid="activate-2"]').exists()).toBe(false)
      })
    })

    it('needs an extra confirmation while placeholders are open', async () => {
      const w = await mount()
      await loaded(w, V2.bodyMd)

      await w.get('[data-testid="activate-2"]').trigger('click')
      const confirmBox = w.get('[data-testid="activate-confirm"]')
      expect(confirmBox.text()).toContain('2 offene Platzhalter')
      expect(w.get('[data-testid="activate-yes"]').attributes('disabled')).toBeDefined()

      await confirmBox.get('input[type="checkbox"]').setValue(true)
      expect(w.get('[data-testid="activate-yes"]').attributes('disabled')).toBeUndefined()
    })

    it('words a single open placeholder in the singular', async () => {
      versions = [{ ...V2, placeholders: 1 }, V1]
      const w = await mount()
      await loaded(w, V2.bodyMd)

      await w.get('[data-testid="activate-2"]').trigger('click')

      expect(w.get('[data-testid="activate-confirm"]').text()).toContain(
        'einen offenen Platzhalter',
      )
    })

    it('asks again from scratch for the next activation', async () => {
      const w = await mount()
      await loaded(w, V2.bodyMd)
      await w.get('[data-testid="activate-2"]').trigger('click')
      await w.get('[data-testid="activate-confirm"] input[type="checkbox"]').setValue(true)
      await w.findAll('[data-testid="activate-confirm"] button')[1].trigger('click')
      expect(w.find('[data-testid="activate-confirm"]').exists()).toBe(false)

      await w.get('[data-testid="activate-2"]').trigger('click')
      await nextTick()

      expect(
        (
          w.get('[data-testid="activate-confirm"] input[type="checkbox"]')
            .element as HTMLInputElement
        ).checked,
      ).toBe(false)
    })

    it('reports a failed activation and leaves the question open', async () => {
      activateFails = 'DB weg'
      versions = [{ ...V2, placeholders: 0 }, V1]
      const w = await mount()
      await loaded(w, V2.bodyMd)

      await w.get('[data-testid="activate-2"]').trigger('click')
      await w.get('[data-testid="activate-yes"]').trigger('click')

      await vi.waitFor(() => {
        expect(w.get('[role="status"]').text()).toBe('Live schalten fehlgeschlagen: DB weg')
      })
      expect(w.find('[data-testid="activate-confirm"]').exists()).toBe(true)
    })
  })
})
