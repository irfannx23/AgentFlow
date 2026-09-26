'use client'

import { useEffect, useRef } from 'react'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Keeps keyboard focus inside a mounted modal and restores it on close. */
export function useDialogFocus<T extends HTMLElement>(close: () => void) {
  const dialogRef = useRef<T>(null)
  const closeRef = useRef(close)
  useEffect(() => { closeRef.current = close }, [close])

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const currentDialog = () => dialogRef.current ?? document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
    const frame = requestAnimationFrame(() => {
      const dialog = currentDialog()
      const first = dialog?.querySelector<HTMLElement>(focusableSelector)
      ;(first ?? dialog)?.focus()
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      const dialog = currentDialog()
      if (event.key !== 'Tab' || !dialog) return
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter(control => control.offsetParent !== null)
      if (!controls.length) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [])

  return dialogRef
}
