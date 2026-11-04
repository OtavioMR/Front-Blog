// Requests are deduplicated for the lifetime of this document, including React remounts.
const attempted = new Set<string>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const READING_DELAY_MS = 5000;

export function trackPostView(postId: string, article: Element): () => void {
  if (!UUID.test(postId) || attempted.has(postId) || typeof IntersectionObserver === "undefined") return () => {};
  let active = true;
  let visible = false;
  let interacted = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancelTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function schedule() {
    cancelTimer();
    if (!active || !visible || !interacted || document.visibilityState !== "visible" || attempted.has(postId)) return;
    timer = setTimeout(() => {
      if (!active || !visible || document.visibilityState !== "visible" || attempted.has(postId)) return;
      attempted.add(postId);
      // A failed or uncertain POST is not retried; it must never affect reading.
      void fetch(`/api/v1/posts/${postId}/views`, { method: "POST", credentials: "omit", cache: "no-store", keepalive: true }).catch(() => {});
    }, READING_DELAY_MS);
  }
  function interact(event: Event) {
    if (!event.isTrusted || interacted) return;
    interacted = true;
    schedule();
  }
  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.target === article && entry.isIntersecting);
    schedule();
  });
  observer.observe(article);
  document.addEventListener("visibilitychange", schedule);
  window.addEventListener("scroll", interact, { passive: true });
  window.addEventListener("pointerdown", interact, { passive: true });
  window.addEventListener("keydown", interact);
  return () => {
    active = false;
    cancelTimer();
    observer.disconnect();
    document.removeEventListener("visibilitychange", schedule);
    window.removeEventListener("scroll", interact);
    window.removeEventListener("pointerdown", interact);
    window.removeEventListener("keydown", interact);
  };
}
