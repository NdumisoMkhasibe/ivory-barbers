"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Download, ImagePlus, LoaderCircle, ScanFace, ShieldCheck, X } from "lucide-react";
import "./preview.css";

const styles = [
  { id: "chiskop", name: "Chiskop" },
  { id: "brush", name: "Brush Cut" },
  { id: "fade", name: "Fade Cut" },
  { id: "trim", name: "Trim" },
  { id: "beard", name: "Beard" },
] as const;

// Only this small, metadata-free image leaves the browser.
async function preparePhoto(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG or WebP photo. HEIC photos can be exported as JPG first.");
  }
  if (file.size > 12 * 1024 * 1024) throw new Error("Please choose a photo smaller than 12 MB.");
  const objectUrl = URL.createObjectURL(file);
  try {
    const photo = new Image();
    photo.src = objectUrl;
    await photo.decode();
    if (!photo.naturalWidth || !photo.naturalHeight) throw new Error("That photo could not be opened. Try another JPG or PNG.");
    const scale = Math.min(1, 500 / photo.naturalWidth, 500 / photo.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare the photo. Please try a different browser.");
    context.fillStyle = "#f8f5ec";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(photo, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Could not prepare this photo. Please try another.")),
      "image/jpeg", 0.9,
    ));
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function Preview({ onBook }: { onBook: (serviceId: string) => void }) {
  const [style, setStyle] = useState("fade");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [resultStyle, setResultStyle] = useState("");
  const [consent, setConsent] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const beforeRef = useRef("");
  const afterRef = useRef("");
  const selectedName = styles.find((item) => item.id === resultStyle)?.name;

  useEffect(() => () => {
    requestRef.current?.abort();
    URL.revokeObjectURL(beforeRef.current);
    URL.revokeObjectURL(afterRef.current);
  }, []);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  function clearResult() {
    URL.revokeObjectURL(afterRef.current);
    afterRef.current = "";
    setAfter("");
    setResultStyle("");
  }

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setPreparing(true);
    clearResult();
    try {
      const prepared = await preparePhoto(file);
      URL.revokeObjectURL(beforeRef.current);
      const url = URL.createObjectURL(prepared);
      beforeRef.current = url;
      setBefore(url);
      setPhoto(prepared);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "This photo could not be opened. Please try another.");
      setPhoto(null);
      setBefore("");
      URL.revokeObjectURL(beforeRef.current);
    } finally {
      setPreparing(false);
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo || !consent || loading || cooldown) return;
    setLoading(true);
    setElapsed(0);
    setError("");
    clearResult();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 65000);
    try {
      const form = new FormData();
      form.append("photo", photo, "portrait.jpg");
      form.append("service", style);
      form.append("consent", "true");
      const response = await fetch("/api/preview", { method: "POST", body: form, signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (response.status === 429) setCooldown(Math.min(86400, Number(response.headers.get("Retry-After")) || 60));
        throw new Error(body?.error || "Preview is temporarily unavailable. Please try again later.");
      }
      if (!response.headers.get("content-type")?.startsWith("image/")) throw new Error("The model returned no image. Please try again later.");
      const result = await response.blob();
      if (result.size > 1024 * 1024) throw new Error("The preview was too large. Please try again later.");
      const url = URL.createObjectURL(result);
      afterRef.current = url;
      setAfter(url);
      setResultStyle(style);
      setCooldown(30);
    } catch (problem) {
      setError(problem instanceof Error && problem.name === "AbortError"
        ? "The preview took too long. Your photo was not saved. Please try again later."
        : problem instanceof Error ? problem.message : "Could not connect to Preview. Check your connection and try again.");
    } finally {
      window.clearTimeout(timeout);
      requestRef.current = null;
      setLoading(false);
    }
  }

  return (
    <section id="preview" className="preview-section" aria-labelledby="preview-heading">
      <div className="preview-inner">
        <div className="preview-heading-row">
          <div><p className="preview-eyebrow">THE NEXT LOOK IS YOURS</p><h2 id="preview-heading">Preview<span>.</span></h2></div>
          <p>Curious about a change? Try a look on your own photo before you take a seat.</p>
        </div>
        <div className="preview-workspace">
          <form onSubmit={generate} className="preview-controls">
            <span className="preview-kicker">A LITTLE INSPIRATION</span>
            <h3>See the look.<br />Make it yours.</h3>
            <p className="preview-intro">Use a clear, well-lit photo with your face and hair visible. One person, facing the camera, works best.</p>
            <label className="preview-upload" htmlFor="preview-photo">
              <ImagePlus size={26} aria-hidden="true" />
              <span><strong>{preparing ? "Preparing your photo…" : photo ? "Change your photo" : "Choose your photo"}</strong><small>JPG, PNG or WebP · up to 12 MB</small></span>
              <input ref={inputRef} id="preview-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} disabled={loading || preparing} aria-describedby="preview-privacy" />
            </label>
            <fieldset className="preview-styles" disabled={loading}>
              <legend>Choose your look</legend>
              <div>{styles.map((item) => <label key={item.id} className={style === item.id ? "selected" : ""}>
                <input type="radio" name="preview-style" value={item.id} checked={style === item.id} onChange={() => setStyle(item.id)} />
                <span>{item.name}</span>
              </label>)}</div>
            </fieldset>
            <label className="preview-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={loading} required /><span>This is my photo, and I agree to send it to Cloudflare for AI processing. <a href="/privacy">Privacy Policy</a></span></label>
            <button className="preview-generate" type="submit" disabled={!photo || !consent || loading || preparing || cooldown > 0}>
              {loading ? <LoaderCircle size={18} className="preview-spinner" aria-hidden="true" /> : null}
              {loading ? "Creating your preview…" : cooldown > 60 ? "Daily preview limit reached" : cooldown > 0 ? `Try again in ${cooldown}s` : "Create My Preview"}
            </button>
            <p className="preview-privacy" id="preview-privacy"><ShieldCheck size={15} aria-hidden="true" /><span>Photos are processed temporarily and are never saved in our database. Two attempts per connection daily; five across this demo. Limits reset at 02:00 SAST.</span></p>
            {error && <p className="preview-error" role="alert">{error}</p>}
          </form>
          <div className="preview-display" aria-busy={loading}>
            <div className="preview-comparison">
              <figure className="preview-frame">
                <figcaption><span>01</span> Your photo</figcaption>
                {before ? <img src={before} alt="Your uploaded photo before the haircut preview" /> : <div className="preview-empty"><ScanFace strokeWidth={1} size={52} aria-hidden="true" /><p>Your next chapter<br />starts with you.</p></div>}
              </figure>
              <figure className="preview-frame preview-frame-after">
                <figcaption><span>02</span> AI preview</figcaption>
                {after ? <img src={after} alt={`AI-generated approximation of you with a ${selectedName}`} /> : <div className="preview-empty">{loading ? <LoaderCircle strokeWidth={1} size={44} className="preview-spinner" aria-hidden="true" /> : null}<p>{loading ? "Your look is taking shape…" : "A fresh perspective.\nYour chosen look."}</p></div>}
              </figure>
            </div>
            <div aria-live="polite" className="preview-status">{loading ? (elapsed > 25 ? "Still creating your image. This may take up to a minute." : "Cloudflare is creating your preview. This usually takes a moment.") : after ? `${selectedName} preview ready. Compare it with your original photo.` : "Your original and AI preview will appear side by side."}</div>
            {after && <div className="preview-result-actions">
              <a className="preview-download" href={after} download={`ivory-${resultStyle}-ai-preview.jpg`}><Download size={17} aria-hidden="true" /> Download preview</a>
              <button type="button" className="preview-book" onClick={() => onBook(resultStyle)}>Book This Look</button>
              <button type="button" className="preview-clear" aria-label="Remove your photos from this page" onClick={() => { clearResult(); URL.revokeObjectURL(beforeRef.current); beforeRef.current = ""; setBefore(""); setPhoto(null); if (inputRef.current) inputRef.current.value = ""; }}><X size={16} aria-hidden="true" /> Clear photos</button>
            </div>}
            <p className="preview-disclaimer">An AI preview is an approximation, not a guaranteed haircut result. Hair texture, length and your barber’s advice will shape the final look.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
