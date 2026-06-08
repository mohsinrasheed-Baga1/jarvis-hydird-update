Option Explicit

Dim shell, fso, root, bat
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(WScript.ScriptFullName)
bat = root & "\START_JARVIS.bat"

shell.Run """" & bat & """", 0, False
