"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { authenticatedFetchForSubject, getOwnProfile, notifyProfileChanged, subscribeSession } from "@/lib/session-client";
import Link from "next/link";
import ImageCrop, { cropImage, defaultCrop } from "@/app/_components/image-crop";
import Avatar from "@/app/_components/avatar";
import AccountBack from "@/app/conta/account-back";
import { uploadPhoto, validatePhoto } from "./photo-upload";
import styles from "../perfil/profile.module.css";
import photo from "./photo.module.css";

type State = "loading" | "ready" | "signed-out" | "error";

export default function PhotoForm() {
  const [state, setState] = useState<State>("loading");
  const [subject, setSubject] = useState("");
  const [name, setName] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [crop, setCrop] = useState(defaultCrop);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const revision = useRef(0);
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);

  const clearSelection = useCallback(() => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); previewUrl.current = null; setPreview(null); setFile(null); if (input.current) input.current.value = ""; }, []);
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);

  const load = useCallback(async () => {
    const generation = ++revision.current;
    setState("loading"); setSubject(""); clearSelection(); setMessage("");
    try {
      const profile = await getOwnProfile();
      if (generation !== revision.current) return;
      if (!profile) { setState("signed-out"); return; }
      setSubject(profile.id); setName(profile.name); setCurrent(profile.profilePhoto || null); setUncertain(false); setState("ready");
    } catch { if (generation === revision.current) setState("error"); }
  }, [clearSelection]);

  useEffect(() => {
    let active = true;
    const generation = revision;
    const unsubscribe = subscribeSession(() => { void load(); });
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; generation.current++; unsubscribe(); };
  }, [load]);

  function choose(selected: File | null) {
    setMessage(""); setFailed(false);
    if (!selected) { clearSelection(); return; }
    const problem = validatePhoto(selected);
    if (problem) { clearSelection(); setFailed(true); setMessage(problem); return; }
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(selected);
    setCrop(defaultCrop); setPreview(previewUrl.current); setFile(selected);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !subject || !file || uncertain) return;
    const generation = revision.current;
    pending.current = true; setBusy(true); setMessage(""); setFailed(false);
    let sent = false;
    try {
      const cropped = await cropImage(file, 1, crop);
      if (generation !== revision.current) return;
      sent = true;
      const result = await uploadPhoto(subject, cropped, authenticatedFetchForSubject);
      if (generation !== revision.current) return;
      if (result.kind === "signed-out") { setState("signed-out"); return; }
      if (result.kind === "account-changed") { void load(); return; }
      if (result.kind === "invalid") { setFailed(true); setMessage(result.message); return; }
      if (result.kind !== "success") throw new Error();
      // Only now, with the API's confirmation, the new photo replaces the old one everywhere.
      setCurrent(result.profilePhoto);
      clearSelection(); setMessage("Foto atualizada com sucesso.");
      notifyProfileChanged();
    } catch {
      if (generation === revision.current) {
        setUncertain(sent); setFailed(true);
        setMessage(sent ? "Não foi possível confirmar o envio. Recarregue sua conta para verificar antes de tentar novamente." : "Não foi possível preparar o recorte. Escolha outra imagem e tente novamente.");
      }
    } finally { pending.current = false; setBusy(false); }
  }

  return <main className={styles.page}><section className={styles.content}>
    <AccountBack />
    <p className={styles.eyebrow}>SEU ESPAÇO</p><h1>Foto de perfil.</h1>
    {state === "loading" && <p role="status">Carregando sua conta…</p>}
    {state === "signed-out" && <p>Entre novamente para atualizar sua foto. <Link href="/entrar">Entrar</Link></p>}
    {state === "error" && <><p role="alert">Não foi possível carregar sua conta.</p><button onClick={() => void load()}>Tentar novamente</button></>}
    {state === "ready" && <>
      <p>Escolha uma imagem JPEG, PNG ou WebP de até 5 MiB. Sua foto pode aparecer publicamente. Sem foto, usamos suas iniciais.</p>
      <div className={photo.preview}>
        <Avatar name={name} src={preview || current} size={128} />
        <div><strong>{preview ? "Prévia da nova foto" : current ? "Foto atual" : "Avatar padrão"}</strong><span>{preview ? "Ainda não enviada. Confirme para salvar." : current ? "Escolha outra imagem para trocar." : "Você ainda não enviou uma foto."}</span></div>
      </div>
      <form className={styles.form} onSubmit={upload} aria-busy={busy}>
        <label htmlFor="photo">{current ? "Trocar imagem" : "Imagem"}</label>
        <input ref={input} id="photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || uncertain} onChange={event => choose(event.target.files?.[0] || null)} />
        {file && <ImageCrop file={file} ratio={1} value={crop} onChange={setCrop} />}
        <div className={photo.actions}>
          <button disabled={busy || uncertain || !file}>{busy ? "Enviando…" : "Salvar foto"}</button>
          {file && !busy && <button type="button" className={photo.secondary} onClick={() => { clearSelection(); setMessage(""); }}>Cancelar</button>}
        </div>
      </form>
      {busy && <p role="status" className={photo.progress}><span className={photo.spinner} aria-hidden="true" />Enviando e processando a imagem…</p>}
      {message && !busy && <p role={failed ? "alert" : "status"} className={failed ? photo.error : photo.success}>{message}</p>}
      {uncertain && <button onClick={() => void load()}>Recarregar conta</button>}
    </>}
  </section></main>;
}
