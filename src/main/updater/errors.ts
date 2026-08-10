/** Güncelleme hatalarının kullanıcıya gösterilebilir Türkçe karşılıkları.
 *
 *  Ham hata mesajı ve yığın izi kullanıcıya GÖSTERİLMEZ; teknik ayrıntı yalnız
 *  geliştirici günlüğüne gider. Saf fonksiyon — test edilebilir. */
export function friendlyUpdateError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ENETUNREACH|network/i.test(message)) {
    return 'Güncelleme sunucusuna ulaşılamadı. İnternet bağlantınızı kontrol edin.'
  }
  if (/\b404\b|not found/i.test(message)) {
    return 'Yayınlanmış bir güncelleme bulunamadı.'
  }
  if (/sha512|checksum|integrity|signature|imza/i.test(message)) {
    return 'Güncelleme dosyasının bütünlük doğrulaması başarısız oldu; kurulum iptal edildi.'
  }
  if (/EACCES|EPERM|permission/i.test(message)) {
    return 'Güncelleme yazılamadı: kurulum klasörüne erişim izni yok.'
  }
  if (/ENOSPC|no space/i.test(message)) {
    return 'Diskte yeterli alan yok; güncelleme indirilemedi.'
  }
  return `Güncelleme hatası: ${message}`
}
