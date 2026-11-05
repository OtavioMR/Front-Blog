"use client";

import { useRef, useState, type FormEvent } from "react";
import styles from "./newsletter-form.module.css";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const running = useRef(false);

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current) return;
    running.current = true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/newsletter/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }), signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        setMessage("Se a inscrição precisar de confirmação, as instruções serão enviadas por e-mail.");
        setEmail("");
      } else if (response.status === 429) {
        setMessage("Muitas tentativas. Aguarde um pouco antes de tentar novamente.");
      } else if (response.status === 400) {
        setMessage("Confira o endereço de e-mail e tente novamente.");
      } else {
        setMessage("Não foi possível confirmar o envio. Confira seu e-mail antes de tentar novamente.");
      }
    } catch {
      setMessage("Não foi possível confirmar o envio. Confira seu e-mail antes de tentar novamente.");
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  return <section className={styles.newsletter} aria-labelledby="newsletter-title">
    <div><h2 id="newsletter-title">Novas leituras no seu e-mail</h2><p>Receba novos artigos. Confirme sua inscrição pelo e-mail enviado.</p></div>
    <form className={styles.form} method="post" action="/api/v1/newsletter/subscribe" onSubmit={subscribe}>
      <label className={styles.label} htmlFor="newsletter-email">Seu e-mail</label>
      <div className={styles.controls}><input className={styles.input} id="newsletter-email" name="email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={event => setEmail(event.target.value)} /><button className={styles.submit} type="submit" disabled={pending}>{pending ? "Enviando…" : "Inscrever-me"}</button></div>
      <p className={styles.message} role="status" aria-live="polite">{message}</p>
    </form>
  </section>;
}
