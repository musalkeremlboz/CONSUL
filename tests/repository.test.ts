/** Remote URL ayrıştırma ve repository adı çözümlemesi.
 *
 *  Bu davranış CONSUL-MEMO klasör adını belirlediği için bir SÖZLEŞMEDİR:
 *  değişirse kullanıcının mevcut hafıza klasörleri "kayıp" görünür. */
import { describe, expect, it } from 'vitest'
import { parseRemoteUrl, resolveMemoName, webUrlFor } from '../src/main/projects/repository'

describe('parseRemoteUrl', () => {
  it('HTTPS GitHub adresini ayrıştırır', () => {
    const parsed = parseRemoteUrl('https://github.com/example/my-awesome-app.git')
    expect(parsed).toMatchObject({
      provider: 'github',
      host: 'github.com',
      owner: 'example',
      name: 'my-awesome-app',
      fullName: 'example/my-awesome-app',
    })
  })

  it('.git eki olmayan HTTPS adresini ayrıştırır', () => {
    expect(parseRemoteUrl('https://github.com/example/my-awesome-app')?.name).toBe('my-awesome-app')
  })

  it('scp benzeri SSH adresini ayrıştırır', () => {
    const parsed = parseRemoteUrl('git@github.com:example/my-awesome-app.git')
    expect(parsed).toMatchObject({ provider: 'github', owner: 'example', name: 'my-awesome-app' })
  })

  it('ssh:// şemalı adresi ayrıştırır', () => {
    const parsed = parseRemoteUrl('ssh://git@github.com:22/example/repo.git')
    expect(parsed).toMatchObject({ host: 'github.com', owner: 'example', name: 'repo' })
  })

  it('GitLab iç içe gruplarını korur', () => {
    const parsed = parseRemoteUrl('https://gitlab.com/group/subgroup/project.git')
    expect(parsed).toMatchObject({
      provider: 'gitlab',
      owner: 'group/subgroup',
      name: 'project',
      fullName: 'group/subgroup/project',
    })
  })

  it('Azure DevOps _git düzenini çözer', () => {
    const parsed = parseRemoteUrl('https://dev.azure.com/org/project/_git/repo')
    expect(parsed).toMatchObject({ provider: 'azure', owner: 'org/project', name: 'repo' })
  })

  it('Bitbucket sağlayıcısını tanır', () => {
    expect(parseRemoteUrl('git@bitbucket.org:team/repo.git')?.provider).toBe('bitbucket')
  })

  it('bilinmeyen sunucuyu "other" sayar', () => {
    expect(parseRemoteUrl('https://git.example.org/team/repo.git')?.provider).toBe('other')
  })

  it('yerel yolu sağlayıcısız çözer', () => {
    // Yerel bir klasör remote olabilir; sağlayıcı "none" olur ama ad çözülür
    const parsed = parseRemoteUrl('/srv/git/bare-repo.git')
    expect(parsed).toMatchObject({ provider: 'none', name: 'bare-repo' })
  })

  it('file:// adresini çözer', () => {
    expect(parseRemoteUrl('file:///C:/repos/demo')?.name).toBe('demo')
  })

  it('boş ve geçersiz girdide null döner', () => {
    expect(parseRemoteUrl('')).toBeNull()
    expect(parseRemoteUrl('   ')).toBeNull()
  })
})

describe('resolveMemoName', () => {
  it('1. öncelik: remote repository adı', () => {
    expect(
      resolveMemoName({
        remoteUrl: 'https://github.com/example/my-awesome-app.git',
        repositoryRoot: '/home/u/checkout-adi',
        projectPath: '/home/u/checkout-adi/alt',
      })
    ).toBe('my-awesome-app')
  })

  it('2. öncelik: remote yoksa repository kök klasörü', () => {
    expect(
      resolveMemoName({ remoteUrl: null, repositoryRoot: '/home/u/local-repo', projectPath: '/home/u/local-repo/src' })
    ).toBe('local-repo')
  })

  it('3. öncelik: git yoksa proje klasörü', () => {
    expect(resolveMemoName({ remoteUrl: null, repositoryRoot: null, projectPath: '/home/u/sade-klasor' })).toBe(
      'sade-klasor'
    )
  })

  it('dosya sistemi için güvensiz karakterleri temizler', () => {
    const name = resolveMemoName({
      remoteUrl: null,
      repositoryRoot: null,
      projectPath: '/home/u/kötü:ad*<test>',
    })
    expect(name).not.toMatch(/[<>:"|?*\\/]/)
    expect(name.length).toBeGreaterThan(0)
  })

  it('sondaki ayraçtan etkilenmez', () => {
    expect(resolveMemoName({ remoteUrl: null, repositoryRoot: null, projectPath: '/home/u/proje/' })).toBe('proje')
  })
})

describe('webUrlFor', () => {
  it('HTTPS adresi üretir', () => {
    expect(webUrlFor(parseRemoteUrl('git@github.com:example/repo.git'))).toBe('https://github.com/example/repo')
  })

  it('yerel repository için null döner', () => {
    expect(webUrlFor(parseRemoteUrl('file:///C:/repos/demo'))).toBeNull()
    expect(webUrlFor(null)).toBeNull()
  })
})
