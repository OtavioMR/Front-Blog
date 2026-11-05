import Link from "next/link";
import styles from "../_components/back-button.module.css";

export default function AccountBack() {
  return <Link href="/conta" data-back-button="true" className={styles.back}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 8H3M7.5 3.5 3 8l4.5 4.5" /></svg>
    <span>Voltar à conta</span>
  </Link>;
}
