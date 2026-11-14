"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import CaptureTools from "./CaptureTools";
import { classifyQRCode, type ScanResult } from "@/lib/qr-scan";
import { getSiteBaseUrl } from "@/lib/site-url";
import styles from "./scanner.module.css";

const modes = ["QR code scanner", "PDF/Zine Scanner", "Pattern Scanner", "ARground", "ARgraf"] as const;
type Mode = typeof modes[number];

type CameraState = "starting" | "ready" | "error" | "paused";
type TorchConstraint = MediaTrackConstraintSet & { torch: boolean };

function cameraError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Allow camera access in browser settings, or import a photo.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found. Import a photo instead.";
  if (name === "NotReadableError") return "Camera in use. Close the other app and retry.";
  return "Camera unavailable. Retry or import a photo.";
}

export default function QRScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<ScanResult | null>(null);
  const mountedRef = useRef(false);
  const photoJobRef = useRef(0);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<Mode>(modes[0]);
  const modeRef = useRef<Mode>(modes[0]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torch, setTorch] = useState(false);
  const [torchBusy, setTorchBusy] = useState(false);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const acceptCode = useCallback((value: string) => {
    if (!mountedRef.current || modeRef.current !== modes[0] || resultRef.current || !value.trim()) return;
    const next = classifyQRCode(value, getSiteBaseUrl());
    resultRef.current = next;
    setResult(next);
    setNotice("");
    setCopied(false);
    setExpanded(false);
    if (next.kind === "native" && next.url) {
      stopCamera();
      // Use the existing redirect endpoint so creator analytics are recorded once.
      window.location.assign(next.url);
    }
  }, [stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    photoJobRef.current = 0;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      mountedRef.current = false;
      photoJobRef.current += 1;
      document.body.style.overflow = oldOverflow;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    function suspend() {
      generation += 1;
      clearTimeout(timer);
      stopCamera();
      setTorch(false);
      setTorchAvailable(false);
    }

    async function start() {
      suspend();
      const run = generation;
      const stale = () => disposed || run !== generation;
      setCamera("starting");
      setMessage("");
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCamera("error");
        setMessage("Camera scanning needs a secure browser connection. Open Zineground over HTTPS, or choose a photo.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stale()) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) { stopCamera(); return; }
        video.srcObject = stream;
        await video.play();
        if (stale()) return;
        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        setTorchAvailable(Boolean(capabilities?.torch));
        const { default: decode } = await import("jsqr");
        if (stale()) return;
        setCamera("ready");
        function scan() {
          if (stale()) return;
          if (modeRef.current === modes[0] && !resultRef.current && !photoJobRef.current && context && video && video.readyState >= 2 && video.videoWidth) {
            const scale = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = decode(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" });
            if (code?.data) acceptCode(code.data);
          }
          timer = setTimeout(scan, 180);
        }
        scan();
      } catch (error) {
        if (stale()) return;
        stopCamera();
        setCamera("error");
        setMessage(cameraError(error));
      }
    }

    function visibilityChanged() {
      if (document.hidden) { suspend(); setCamera("paused"); }
      else if (resultRef.current?.kind !== "native") void start();
    }
    function pageRestored(event: PageTransitionEvent) {
      if (!event.persisted) return;
      if (resultRef.current?.kind === "native") {
        resultRef.current = null;
        setResult(null);
      }
      void start();
    }
    if (!document.hidden) void start();
    else setCamera("paused");
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("pagehide", suspend);
    window.addEventListener("pageshow", pageRestored);
    return () => {
      disposed = true;
      generation += 1;
      clearTimeout(timer);
      stopCamera();
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("pagehide", suspend);
      window.removeEventListener("pageshow", pageRestored);
    };
  }, [attempt, acceptCode, stopCamera]);

  function scanAgain() {
    resultRef.current = null;
    setResult(null);
    setNotice("");
    if (!streamRef.current) setAttempt((value) => value + 1);
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || torchBusy) return;
    setTorchBusy(true);
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as TorchConstraint] });
      setTorch(!torch);
    } catch { setNotice("The flashlight isn’t available on this camera."); }
    finally { setTorchBusy(false); }
  }

  async function readPhoto(file?: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setNotice("Choose an image smaller than 20 MB."); return; }
    const job = Date.now();
    photoJobRef.current = job;
    setReadingPhoto(true);
    setNotice("");
    resultRef.current = null;
    setResult(null);
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = objectUrl;
      await img.decode();
      const { default: decode } = await import("jsqr");
      if (!mountedRef.current || photoJobRef.current !== job || modeRef.current !== modes[0]) return;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas unavailable");
      // A second resolution helps with small QR codes in large photographs.
      for (const maxSize of [1000, 2000]) {
        const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = decode(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" });
        if (code?.data) { acceptCode(code.data); return; }
      }
      setNotice("No QR code found. Try a clearer photo with the whole code visible.");
    } catch {
      if (mountedRef.current && photoJobRef.current === job) setNotice("We couldn’t read that image. Try a JPG, PNG, or WebP photo.");
    } finally {
      URL.revokeObjectURL(objectUrl);
      if (mountedRef.current && photoJobRef.current === job) {
        photoJobRef.current = 0;
        setReadingPhoto(false);
      }
    }
  }

  async function copyResult() {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.value); setCopied(true); }
    catch { setNotice("Copy isn’t available. Press and hold the content to select it."); }
  }

  function changeMode(next: Mode) {
    modeRef.current = next;
    photoJobRef.current = 0;
    setReadingPhoto(false);
    setMode(next);
    resultRef.current = null;
    setResult(null);
    setNotice("");
  }

  return (
    <main className={styles.scanner} aria-label="Zineground scanner">
      <video ref={videoRef} className={styles.video} autoPlay muted playsInline aria-hidden="true" />
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.iconButton} aria-label="Close scanner">✕</Link>
        <select className={styles.modeSelect} aria-label="Scanner mode" value={mode} onChange={event => changeMode(event.target.value as Mode)}>
          {modes.map(item => <option key={item}>{item}</option>)}
        </select>
        <button className={styles.iconButton} onClick={() => changeMode(modes[(modes.indexOf(mode) + 1) % modes.length])} aria-label="Next scanner mode">↻</button>
      </header>
      <div className={styles.viewfinder}>
        <div className={`${styles.frame} ${mode === "PDF/Zine Scanner" ? styles.documentFrame : mode === "Pattern Scanner" ? styles.patternFrame : ""}`} aria-hidden="true"><i /><i /><i /><i /></div>
        {camera === "starting" && <p className={styles.status} role="status">Opening camera…</p>}
        {camera === "paused" && <p className={styles.status} role="status">Camera paused</p>}
      </div>
      <div className={styles.bottom}>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {mode === modes[0] && result ? (
          <section className={styles.result} aria-label="Scan result" aria-live="polite">
            <div className={styles.resultTop}><h2>{result.title}</h2><button onClick={scanAgain} className={styles.iconButton} aria-label="Dismiss result">✕</button></div>
            <p className={`${styles.payload} ${expanded ? styles.expanded : ""}`} dir="auto">{result.value}</p>
            {result.value.length > 160 && <button className={styles.textButton} onClick={() => setExpanded(!expanded)}>{expanded ? "Show less" : "Show full content"}</button>}
            <div className={styles.actions}>
              {result.url ? <a className={styles.primary} href={result.url} onClick={stopCamera}>Open link</a> : <button className={styles.primary} onClick={copyResult}>{copied ? "Copied" : "Copy"}</button>}
              <button className={styles.secondary} onClick={scanAgain}>Scan again</button>
              {result.url && <button className={styles.secondary} onClick={copyResult}>{copied ? "Copied" : "Copy"}</button>}
            </div>
          </section>
        ) : null}
        {camera === "error" && !result && <div className={styles.permission} role="status"><p>{message}</p><button className={styles.textButton} onClick={() => setAttempt(value => value + 1)}>Retry camera</button></div>}
        {mode === modes[0] ? <>
          <div className={styles.toolbar}>
            <button className={styles.secondary} onClick={toggleTorch} disabled={!torchAvailable || torchBusy} aria-pressed={torch}>{torch ? "Light off" : "Light"}</button>
            <button className={styles.primary} onClick={() => fileRef.current?.click()} disabled={readingPhoto}>{readingPhoto ? "Reading…" : "Import photo"}</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className={styles.fileInput} aria-label="Choose a QR code photo" onChange={event => { void readPhoto(event.target.files?.[0]); event.target.value = ""; }} />
        </> : mode === "ARground" || mode === "ARgraf" ? <section className={styles.setup}>
          <h2>{mode}</h2>
          <p>{mode === "ARground" ? "Partner AR experiences will appear here." : "Place your art over a flyer. Refer creative work through Kairos Market."}</p>
          <span>In development</span>
        </section> : null}
        <div hidden={mode !== "PDF/Zine Scanner" && mode !== "Pattern Scanner"}><CaptureTools kind={mode === "Pattern Scanner" ? "pattern" : "pdf"} videoRef={videoRef} ready={camera === "ready"} /></div>
      </div>
    </main>
  );
}
