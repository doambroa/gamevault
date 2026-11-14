; GameVault · añadidos al instalador NSIS de electron-builder
; Acceso «Desinstalar GameVault» en el menú Inicio que abre directamente el asistente de
; desinstalación (el «Desinstalar» del botón derecho de Windows lleva a Configuración → Aplicaciones).

!macro customInstall
  CreateDirectory "$SMPROGRAMS\GameVault"
  CreateShortCut "$SMPROGRAMS\GameVault\Desinstalar GameVault.lnk" "$INSTDIR\Uninstall GameVault.exe" "" "$INSTDIR\Uninstall GameVault.exe" 0 SW_SHOWNORMAL "" "Abre el asistente para desinstalar GameVault"
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\GameVault\Desinstalar GameVault.lnk"
  Delete "$SMPROGRAMS\GameVault\GameVault.lnk"
  RMDir "$SMPROGRAMS\GameVault"
  ; Copia del instalador que guarda electron-builder para autoactualizaciones (GameVault no las usa): 80 MB
  RMDir /r "$LOCALAPPDATA\gamevault-updater"
!macroend
