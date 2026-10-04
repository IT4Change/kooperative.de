import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'

import MarkdownEditor from './MarkdownEditor.vue'

/**
 * The editor of the legal texts: a textarea, a toolbar that writes the Markdown
 * for the operator, and a preview rendered by the server. The toolbar works on
 * the selection, so the tests set one and check text and selection afterwards.
 */

/** Each preview request takes the next answer; an answer may be held back. */
interface Answer {
  html?: string
  placeholders?: string[]
  fail?: boolean
  gate?: Promise<void>
}
let answers: Answer[] = []
const requests: string[] = []

registerEndpoint('/admin/api/legal/preview', {
  method: 'POST',
  handler: async (event) => {
    const { bodyMd } = await readBody<{ bodyMd: string }>(event)
    requests.push(bodyMd)
    const answer = answers.shift() ?? {}
    await answer.gate
    if (answer.fail) throw createError({ statusCode: 500, statusMessage: 'kaputt' })
    return { html: answer.html ?? `<p>${bodyMd}</p>`, placeholders: answer.placeholders ?? [] }
  },
})

let unmount: (() => void) | null = null

beforeEach(() => {
  answers = []
  requests.length = 0
})

afterEach(() => {
  unmount?.()
  unmount = null
})

async function mount(modelValue: string) {
  const wrapper = await mountSuspended(MarkdownEditor, {
    props: {
      modelValue,
      'onUpdate:modelValue': async (value: string) => wrapper.setProps({ modelValue: value }),
    },
    attachTo: document.body,
  })
  unmount = () => {
    wrapper.unmount()
  }
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mount>>

const textarea = (w: Wrapper) => w.get('textarea').element
const preview = (w: Wrapper) => w.get('[data-testid="md-preview"]').element.innerHTML

function select(w: Wrapper, start: number, end = start) {
  textarea(w).setSelectionRange(start, end)
}

async function press(w: Wrapper, action: string) {
  await w.get(`[data-action="${action}"]`).trigger('click')
  await nextTick()
  await nextTick()
}

const selection = (w: Wrapper) =>
  textarea(w).value.slice(textarea(w).selectionStart, textarea(w).selectionEnd)

describe('toolbar', () => {
  it('makes the current line a heading', async () => {
    const w = await mount('Einleitung\nTitel\nText')
    select(w, 13)

    await press(w, 'h2')

    expect(textarea(w).value).toBe('Einleitung\n## Titel\nText')
  })

  it('switches the heading level instead of stacking markers', async () => {
    const w = await mount('## Titel')
    select(w, 4)

    await press(w, 'h3')

    expect(textarea(w).value).toBe('### Titel')
  })

  it('turns every selected line into a list item', async () => {
    const w = await mount('a\nb\nc')
    select(w, 0, 3)

    await press(w, 'ul')

    expect(textarea(w).value).toBe('- a\n- b\nc')
    expect(selection(w)).toBe('- a\n- b')
  })

  it('numbers the selected lines', async () => {
    const w = await mount('a\n- b')
    select(w, 0, 5)

    await press(w, 'ol')

    expect(textarea(w).value).toBe('1. a\n2. b')
  })

  it('works on the last line, which has no line break after it', async () => {
    const w = await mount('a\nb')
    select(w, 3)

    await press(w, 'h3')

    expect(textarea(w).value).toBe('a\n### b')
  })

  it('makes the selection bold and keeps it selected', async () => {
    const w = await mount('ganz wichtig')
    select(w, 5, 12)

    await press(w, 'bold')

    expect(textarea(w).value).toBe('ganz **wichtig**')
    expect(selection(w)).toBe('wichtig')
  })

  it('inserts a bold sample when nothing is selected', async () => {
    const w = await mount('')
    select(w, 0)

    await press(w, 'bold')

    expect(textarea(w).value).toBe('**fett**')
    expect(selection(w)).toBe('fett')
  })

  it('wraps the selection in a link and selects the URL to type next', async () => {
    const w = await mount('siehe Impressum')
    select(w, 6, 15)

    await press(w, 'link')

    expect(textarea(w).value).toBe('siehe [Impressum](https://)')
    expect(selection(w)).toBe('https://')
  })

  it('inserts a sample link when nothing is selected', async () => {
    const w = await mount('')

    await press(w, 'link')

    expect(textarea(w).value).toBe('[Linktext](https://)')
  })

  it('marks the selection as a placeholder', async () => {
    const w = await mount('Hoster: Firma')
    select(w, 8, 13)

    await press(w, 'placeholder')

    expect(textarea(w).value).toBe('Hoster: [[Firma]]')
    expect(selection(w)).toBe('Firma')
  })

  it('inserts an empty placeholder when nothing is selected', async () => {
    const w = await mount('')

    await press(w, 'placeholder')

    expect(textarea(w).value).toBe('[[Angabe fehlt]]')
  })

  it('passes typing through', async () => {
    const w = await mount('')

    await w.get('textarea').setValue('neu')

    expect(w.emitted('update:modelValue')?.at(-1)).toStrictEqual(['neu'])
  })
})

describe('preview', () => {
  it('shows the server rendering of the text and reports its placeholders', async () => {
    answers = [{ html: '<h2>Titel</h2>', placeholders: ['Hoster'] }]

    const w = await mount('## Titel')

    await vi.waitFor(() => {
      expect(preview(w)).toBe('<h2>Titel</h2>')
    })
    expect(w.emitted('placeholders')?.at(-1)).toStrictEqual([['Hoster']])
  })

  it('follows the text after a pause in typing', async () => {
    const w = await mount('eins')
    await vi.waitFor(() => {
      expect(preview(w)).toBe('<p>eins</p>')
    })

    await w.get('textarea').setValue('zwei')

    await vi.waitFor(() => {
      expect(preview(w)).toBe('<p>zwei</p>')
    })
  })

  it('asks the server nothing for an empty text', async () => {
    const w = await mount('')

    await vi.waitFor(() => {
      expect(w.emitted('placeholders')).toStrictEqual([[[]]])
    })
    expect(requests).toStrictEqual([])
    expect(preview(w)).toBe('')
  })

  it('says so when the preview fails', async () => {
    answers = [{ fail: true }]

    const w = await mount('x')

    await vi.waitFor(() => {
      expect(w.text()).toContain('Vorschau nicht verfügbar')
    })
  })

  it('ignores an answer that arrives after a newer one', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    answers = [{ html: '<p>alt</p>', gate }, { html: '<p>neu</p>' }]

    const w = await mount('alt')
    await vi.waitFor(() => {
      expect(requests).toHaveLength(1)
    })
    await w.get('textarea').setValue('neu')
    await vi.waitFor(() => {
      expect(preview(w)).toBe('<p>neu</p>')
    })

    release()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(preview(w)).toBe('<p>neu</p>')
  })

  it('ignores a failure that arrives after a newer answer', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    answers = [{ fail: true, gate }, { html: '<p>neu</p>' }]

    const w = await mount('alt')
    await vi.waitFor(() => {
      expect(requests).toHaveLength(1)
    })
    await w.get('textarea').setValue('neu')
    await vi.waitFor(() => {
      expect(preview(w)).toBe('<p>neu</p>')
    })

    release()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(w.text()).not.toContain('Vorschau nicht verfügbar')
  })
})
