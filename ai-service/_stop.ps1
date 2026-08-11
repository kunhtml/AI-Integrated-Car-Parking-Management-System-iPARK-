$conn = Get-NetTCPConnection -LocalPort 5050 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  $pids = $conn | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($p in $pids) {
    Stop-Process -Id ([int]$p) -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Seconds 2
$remaining = Get-NetTCPConnection -LocalPort 5050 -State Listen -ErrorAction SilentlyContinue | Measure-Object
Write-Output ("Remaining listeners: " + $remaining.Count)
