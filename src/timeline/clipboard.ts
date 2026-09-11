export async function writeTextToClipboard(text: string) {
  const transfer = document.createElement('textarea')
  transfer.value = text
  transfer.setAttribute('readonly', '')
  transfer.style.position = 'fixed'
  transfer.style.opacity = '0'
  document.body.append(transfer)
  transfer.select()
  const copied = typeof document.execCommand === 'function' && document.execCommand('copy')
  transfer.remove()

  if (copied) return
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
  await navigator.clipboard.writeText(text)
}
