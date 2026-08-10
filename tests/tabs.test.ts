/** Sekme yaşam döngüsü — ekleme, kapatma, odak devri, sıralama, adlandırma. */
import { describe, expect, it } from 'vitest'
import { initialTabs, tabsReducer, titleForPath, type Tab, type TabsState } from '../src/renderer/src/state/tabs'

function tab(key: string, extra: Partial<Tab> = {}): Tab {
  return { key, title: key, renamed: false, cwd: `/p/${key}`, shellId: 'bash', status: 'running', ...extra }
}

function withTabs(...keys: string[]): TabsState {
  return keys.reduce<TabsState>((state, key) => tabsReducer(state, { type: 'add', tab: tab(key) }), initialTabs)
}

describe('tabsReducer', () => {
  it('eklenen sekme aktif olur', () => {
    const state = tabsReducer(initialTabs, { type: 'add', tab: tab('a') })
    expect(state.tabs).toHaveLength(1)
    expect(state.activeKey).toBe('a')
  })

  it('aktif sekme kapanınca odak komşuya geçer', () => {
    const state = tabsReducer(withTabs('a', 'b', 'c'), { type: 'activate', key: 'b' })
    const closed = tabsReducer(state, { type: 'close', key: 'b' })
    expect(closed.tabs.map((t) => t.key)).toEqual(['a', 'c'])
    expect(closed.activeKey).toBe('c')
  })

  it('son sekme kapanınca aktif sekme kalmaz', () => {
    const closed = tabsReducer(withTabs('a'), { type: 'close', key: 'a' })
    expect(closed.tabs).toHaveLength(0)
    expect(closed.activeKey).toBeNull()
  })

  it('aktif olmayan sekmenin kapanması odağı değiştirmez', () => {
    const state = withTabs('a', 'b')
    const closed = tabsReducer(state, { type: 'close', key: 'a' })
    expect(closed.activeKey).toBe('b')
  })

  it('çıkış kodunu ve durumu işler', () => {
    const state = tabsReducer(withTabs('a'), { type: 'exit', key: 'a', exitCode: 130 })
    expect(state.tabs[0].status).toBe('exited')
    expect(state.tabs[0].exitCode).toBe(130)
  })

  it('yeniden adlandırma kalıcı işaret bırakır', () => {
    const state = tabsReducer(withTabs('a'), { type: 'rename', key: 'a', title: '  derleme  ' })
    expect(state.tabs[0].title).toBe('derleme')
    expect(state.tabs[0].renamed).toBe(true)
  })

  it('boş ada izin vermez', () => {
    const before = withTabs('a')
    expect(tabsReducer(before, { type: 'rename', key: 'a', title: '   ' })).toBe(before)
  })

  it('sekmeleri yeniden sıralar', () => {
    const state = tabsReducer(withTabs('a', 'b', 'c'), { type: 'move', from: 0, to: 2 })
    expect(state.tabs.map((t) => t.key)).toEqual(['b', 'c', 'a'])
  })

  it('geçersiz sıralama isteğini yok sayar', () => {
    const before = withTabs('a', 'b')
    expect(tabsReducer(before, { type: 'move', from: 0, to: 9 })).toBe(before)
    expect(tabsReducer(before, { type: 'move', from: -1, to: 1 })).toBe(before)
  })

  it('bilinmeyen sekmeyi etkinleştirmez', () => {
    const before = withTabs('a')
    expect(tabsReducer(before, { type: 'activate', key: 'yok' })).toBe(before)
  })

  it('çalışma dizinini günceller', () => {
    const state = tabsReducer(withTabs('a'), { type: 'setCwd', key: 'a', cwd: '/yeni' })
    expect(state.tabs[0].cwd).toBe('/yeni')
  })
})

describe('titleForPath', () => {
  it('klasör adını kullanır', () => {
    expect(titleForPath('/home/u/proje')).toBe('proje')
    expect(titleForPath('C:\\Users\\u\\proje\\')).toBe('proje')
  })

  it('boş girdide yedek verir', () => {
    expect(titleForPath('')).toBe('terminal')
  })
})
