$ErrorActionPreference = 'Stop'
$secureToken = Read-Host 'BotFather tokenini kiriting (ekranda korinmaydi)' -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try { $botToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer) }
function Invoke-Telegram($method, $body) {
  try { $result = Invoke-RestMethod -Method Post -Uri ("https://api.telegram.org/bot" + $botToken + '/' + $method) -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 8) }
  catch { throw 'Telegram bilan aloqa amalga oshmadi. Token va internetni tekshiring.' }
  if (!$result.ok) { throw 'Telegram sorovni qabul qilmadi.' }
  return $result.result
}
try {
  $me = Invoke-Telegram 'getMe' @{}
  if ($me.username -ne 'buuuurgutbot') { throw 'Bu token @buuuurgutbot uchun emas. Toxtatildi.' }
  $webhook = Invoke-Telegram 'getWebhookInfo' @{}
  if ($webhook.url) { throw 'Botda webhook allaqachon bor. Mavjud ulanishni tekshirmasdan almashtirilmaydi.' }
  Write-Host '@buuuurgutbot ga Telegramda /start yozing.'
  Read-Host 'Yozganingizdan keyin Enter bosing' | Out-Null
  $updates = @(Invoke-Telegram 'getUpdates' @{allowed_updates=@('message');timeout=0})
  $chats = @($updates | Where-Object { $_.message.chat.type -eq 'private' -and $_.message.chat.id -eq $_.message.from.id } | ForEach-Object { $_.message.chat.id.ToString() } | Select-Object -Unique)
  if ($chats.Count -ne 1) { throw 'Bitta shaxsiy chat aniqlanmadi. Avval botga /start yuboring; bir nechta chat bolsa egasini alohida tanlash kerak.' }
  $ownerId = $chats[0]
  $secretBytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($secretBytes) } finally { $rng.Dispose() }
  $webhookSecret = ([BitConverter]::ToString($secretBytes)).Replace('-','').ToLowerInvariant()
  Write-Host 'Netlify > Environment variables ga quyidagi IKKITA maxfiy qiymatni kiriting (Functions scope):'
  Write-Host ('TELEGRAM_OWNER_ID = ' + $ownerId)
  Write-Host ('TELEGRAM_WEBHOOK_SECRET = ' + $webhookSecret)
  Write-Host 'Bu qiymatlarni chatga yubormang. Bot tokenini sayt fayliga yozmang.'
  Read-Host 'Paket va sozlamalarni Netlifyga deploy qilgach Enter bosing' | Out-Null
  $siteUrl = 'https://ornate-alfajores-5402f7.netlify.app'
  $endpoint = $siteUrl + '/.netlify/functions/telegram'
  # A harmless update verifies the deployed function and secret before registration.
  try { Invoke-WebRequest -Method Post -Uri $endpoint -Headers @{'X-Telegram-Bot-Api-Secret-Token'=$webhookSecret} -ContentType 'application/json' -Body '{"update_id":0}' -UseBasicParsing | Out-Null }
  catch { throw 'Netlify funksiyasi yoki maxfiy sozlamalar hali tayyor emas. Webhook ozgartirilmadi.' }
  Invoke-Telegram 'setWebhook' @{url=$endpoint;secret_token=$webhookSecret;allowed_updates=@('message');drop_pending_updates=$false} | Out-Null
  $check = Invoke-Telegram 'getWebhookInfo' @{}
  if ($check.url -ne $endpoint) { throw 'Webhook manzili tasdiqlanmadi.' }
  Write-Host 'Webhook ulandi. Telegramda /start ni qayta yuborib tekshiring.'
} catch { Write-Host $_.Exception.Message }
finally { $botToken=$null; $secureToken=$null; $webhookSecret=$null }
