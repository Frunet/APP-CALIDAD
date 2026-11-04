# Ejecutar UNA vez como administrador: abre los puertos 5180 (app) y 8200 (Supabase) solo para la red local.
$reglas = @(
  @{ Nombre = 'Quality Control - App (5180)'; Puerto = 5180 },
  @{ Nombre = 'Quality Control - Supabase (8200)'; Puerto = 8200 }
)
foreach ($r in $reglas) {
  if (-not (Get-NetFirewallRule -DisplayName $r.Nombre -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $r.Nombre -Direction Inbound -Protocol TCP -LocalPort $r.Puerto -RemoteAddress LocalSubnet -Action Allow -Profile Any | Out-Null
  }
}
Write-Host 'Puertos 5180 y 8200 abiertos para la red local.'
