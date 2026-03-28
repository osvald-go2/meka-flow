import { execSync } from 'child_process'
import { screen } from 'electron'

/**
 * Detect if the current MacBook has a hardware notch.
 * Checks hw.model against known notch models:
 * - MacBookPro18+ (2021 M1 Pro/Max and later)
 * - MacBookAir11+ (2022 M2 and later)
 */
export function hasHardwareNotch(): boolean {
  try {
    const model = execSync('sysctl -n hw.model').toString().trim()
    if (/^MacBookPro(1[8-9]|[2-9]\d),/.test(model)) return true
    if (/^MacBookAir(1[1-9]|[2-9]\d),/.test(model)) return true
    // Apple Silicon Mac identifiers (Mac15,x etc.)
    if (/^Mac(1[5-9]|[2-9]\d),/.test(model)) return true
    return false
  } catch {
    return false
  }
}

/**
 * Check if the internal (built-in) display is active.
 * The notch overlay only shows on the internal display.
 */
export function getInternalDisplay(): Electron.Display | null {
  const displays = screen.getAllDisplays()
  for (const d of displays) {
    if ((d as any).internal === true) return d
    const label = (d.label || '').toLowerCase()
    if (
      label.includes('built-in') ||
      label.includes('color lcd') ||
      label.includes('liquid retina')
    ) {
      return d
    }
  }
  // Fallback: primary display if only one display connected
  if (displays.length === 1) return displays[0]
  return null
}

/**
 * Get the notch height (menu bar offset) from display work area.
 */
export function getNotchHeight(display: Electron.Display): number {
  const topOffset = display.workArea.y - display.bounds.y
  return topOffset > 0 ? topOffset : 40
}
