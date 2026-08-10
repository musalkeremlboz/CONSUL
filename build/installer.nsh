; CONSUL — NSIS ek yapılandırması
;
; CONSUL Developer, ana uygulamayla aynı ikiliyi kullanır ancak `--developer`
; bayrağıyla AYRI BİR SÜREÇ olarak açılır: kendi penceresi, kendi `userData`
; dizini ve kendi tek-örnek kilidi vardır. Kurulum, kullanıcının her ikisini de
; bağımsız başlatabilmesi için Başlat menüsüne ikinci bir giriş ekler.

!macro customInstall
  CreateShortCut "$SMPROGRAMS\CONSUL Developer.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--developer" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 SW_SHOWNORMAL "" "CONSUL Developer — Claude Code ile CONSUL gelistirme terminali"
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\CONSUL Developer.lnk"
!macroend
