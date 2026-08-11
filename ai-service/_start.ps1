$env:KMP_DUPLICATE_LIB_OK = 'TRUE'
$env:OMP_NUM_THREADS = '2'
$dir = 'c:\Users\stew\Desktop\bai-do-xe-main (9)\bai-do-xe-main\ai-service'
Set-Location $dir
Start-Process -FilePath "python" -ArgumentList "app.py" -WorkingDirectory $dir `
  -RedirectStandardOutput ".\ai.log" -RedirectStandardError ".\ai.err.log" `
  -WindowStyle Hidden
Write-Output "Started"
