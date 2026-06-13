!macro customHeader
  !system "echo 'Building JARVIS Hybrid Installer...'"
!macroend

!macro customInstall
  ; Create additional shortcuts
  CreateShortCut "$SMPROGRAMS\JARVIS Hybrid\JARVIS Help.lnk" "$INSTDIR\JARVIS Hybrid.exe"

  ; Register custom URL protocol (optional)
  WriteRegStr HKCR "jarvis" "" "URL:JARVIS Protocol"
  WriteRegStr HKCR "jarvis" "URL Protocol" ""
  WriteRegStr HKCR "jarvis\shell\open\command" "" '"$INSTDIR\JARVIS Hybrid.exe" "%1"'

  ; Add to PATH (optional, for CLI access)
  ; EnVar::AddValue "PATH" "$INSTDIR"
!macroend

!macro customUnInstall
  ; Remove custom shortcuts
  Delete "$SMPROGRAMS\JARVIS Hybrid\JARVIS Help.lnk"

  ; Remove URL protocol
  DeleteRegKey HKCR "jarvis"
!macroend

!macro customRemoveFiles
  ; Clean up any remaining files
  RMDir /r "$APPDATA\JARVIS Hybrid\logs"
!macroend
