/** Klavye dinleyicileri bu hedeflerde calismamali (barkod vb.). */
export function isEditableKeyboardTarget(el: EventTarget | null | undefined): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return !!el.closest(
    "input:not([type='button']):not([type='submit']):not([type='reset']):not([type='checkbox']):not([type='radio']), textarea, select, [contenteditable]:not([contenteditable='false'])"
  );
}
