If WScript.Arguments.Count = 0 Then
  WScript.Quit 1
End If

Dim shell
Dim scriptPath
Dim cmdArgs

scriptPath = WScript.Arguments(0)
cmdArgs = "/k " & Chr(34) & scriptPath & Chr(34)

Set shell = CreateObject("Shell.Application")
shell.ShellExecute "cmd.exe", cmdArgs, "", "runas", 1
