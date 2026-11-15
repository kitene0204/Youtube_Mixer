/** 누른 채로 밖으로 끌어도 계속 따라오게 (실패해도 무시) */
export function capture(e: { currentTarget: EventTarget; pointerId: number }) {
  try {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  } catch {}
}
