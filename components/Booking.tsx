"use client";

import { useEffect, useRef, useState } from "react";
import { BARBERS, SERVICES } from "../lib/catalog";
import "./booking.css";

type Slot = { time: string; startAt: string; endAt: string };
type SavedBooking = {
  id: string; serviceId: string; serviceName: string; barberId: string; barberName: string;
  price: number; duration: number; startAt: string; endAt: string; firstName: string;
  surname: string; email: string; phone: string; location: string;
};
type Confirmation = { booking: SavedBooking; googleCalendarUrl: string; icsUrl: string };
const steps = ["Barber", "Service", "Date & time", "Your details", "Review"];
const zone = "Africa/Johannesburg";
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: zone }).format(new Date(`${date}T12:00:00+02:00`));
const instantTime = (instant: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: zone }).format(new Date(instant));
const shopToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function Hourglass() {
  return <svg className="booking-hourglass" viewBox="0 0 100 130" fill="none" aria-hidden="true"><path d="M22 10h56M22 120h56M28 12v19c0 18 12 26 22 34-10 8-22 16-22 34v19M72 12v19c0 18-12 26-22 34 10 8 22 16 22 34v19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><path d="M34 30h32c-2 13-10 18-16 23-6-5-14-10-16-23ZM34 109c1-13 9-20 16-27 7 7 15 14 16 27H34Z" fill="currentColor" opacity=".75"/><path d="M50 60v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}

export default function Booking({ selectedService }: { selectedService?: string }) {
  const [step, setStep] = useState(0);
  const [barberId, setBarberId] = useState("");
  const [serviceId, setServiceId] = useState(selectedService || "");
  const [date, setDate] = useState("");
  const [month, setMonth] = useState(() => shopToday().slice(0, 7));
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [details, setDetails] = useState({ firstName: "", surname: "", phone: "", email: "" });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const service = SERVICES.find((item) => item.id === serviceId);
  const barber = BARBERS.find((item) => item.id === barberId);
  const selectedSlot = slots.find((slot) => slot.time === time);
  const today = shopToday();

  useEffect(() => { setHydrated(true); }, []);

  const preselect = (id: string) => {
    if (!SERVICES.some((item) => item.id === id)) return;
    setServiceId(id); setStep(0); setTime(""); setConsent(false); setSubmitError(""); setConfirmation(null);
  };
  useEffect(() => { if (selectedService) preselect(selectedService); }, [selectedService]);
  useEffect(() => {
    const listener = (event: Event) => {
      const value = (event as CustomEvent<string | { serviceId?: string; service?: string }>).detail;
      const id = typeof value === "string" ? value : value?.serviceId || value?.service;
      if (id) preselect(id);
    };
    window.addEventListener("ivory:book", listener);
    const requested = new URLSearchParams(window.location.search).get("service");
    if (requested) preselect(requested);
    return () => window.removeEventListener("ivory:book", listener);
  }, []);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus({ preventScroll: true });
    if (heading.current && heading.current.getBoundingClientRect().top < 90) heading.current.scrollIntoView({ block: "center", behavior: "instant" });
  }, [step, confirmation]);
  useEffect(() => {
    if (!date || !barberId || !serviceId || step !== 2) return;
    const controller = new AbortController();
    setLoadingSlots(true); setSlotsError(""); setSlots([]);
    const query = new URLSearchParams({ date, service: serviceId, barber: barberId });
    fetch(`/api/availability?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "We couldn’t load available appointments. Please try again.");
        setSlots(data.slots || []);
        setTime((old) => data.slots?.some((slot: Slot) => slot.time === old) ? old : "");
      })
      .catch((error: Error) => { if (error.name !== "AbortError") setSlotsError(error.message || "Couldn’t connect. Please try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoadingSlots(false); });
    return () => controller.abort();
  }, [date, barberId, serviceId, step, refresh]);

  function goTo(next: number) { setStep(next); setSubmitError(""); }
  function chooseDate(next: string) { setDate(next); setTime(""); }
  function shiftMonth(offset: number) {
    const value = new Date(`${month}-01T12:00:00`);
    value.setMonth(value.getMonth() + offset);
    setMonth(isoDay(value).slice(0, 7));
  }
  async function saveBooking() {
    if (!consent || submitting || !service || !date || !time || !barberId) return;
    setSubmitting(true); setSubmitError("");
    try {
      const response = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ barberId, serviceId, date, time, ...details, termsAccepted: consent }) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) { setStep(2); setTime(""); setRefresh((value) => value + 1); }
        throw new Error(data.error || "Your booking could not be saved. Please try again.");
      }
      if (!data.booking?.id || !data.googleCalendarUrl || !data.icsUrl) throw new Error("We couldn’t verify your booking confirmation. Please use the contact form before trying again.");
      setConfirmation(data);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Couldn’t connect. Your booking has not been confirmed.");
    } finally { setSubmitting(false); }
  }
  function resetBooking() {
    setConfirmation(null); setStep(0); setBarberId(""); setServiceId(""); setDate(""); setTime("");
    setDetails({ firstName: "", surname: "", phone: "", email: "" }); setConsent(false); setSubmitError("");
  }

  const monthDate = new Date(`${month}-01T12:00:00`);
  const monthTitle = new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric" }).format(monthDate);
  const calendarStart = new Date(monthDate);
  calendarStart.setDate(1 - ((monthDate.getDay() + 6) % 7));
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(calendarStart); day.setDate(day.getDate() + index);
    return { day, iso: isoDay(day), inMonth: day.getMonth() === monthDate.getMonth() };
  });

  return <section id="book" className="booking-section" aria-labelledby="book-title">
    <div className="booking-intro"><span className="booking-eyebrow">YOUR NEXT GOOD HAIR DAY</span><h2 id="book-title">Make time for <em>yourself.</em></h2><p>A familiar face. A fresh perspective. Choose your barber and we’ll take care of the details.</p></div>
    <div className="booking-shell">
      {confirmation ? <div className="booking-confirmation">
        <span className="booking-success-mark" aria-hidden="true">✓</span>
        <span className="booking-eyebrow">SAVED SUCCESSFULLY</span>
        <h3 ref={heading} tabIndex={-1}>Your appointment is booked.</h3>
        <p>Looking sharp starts here, {confirmation.booking.firstName}. Your appointment is saved. Add it to your calendar below.</p>
        <dl className="booking-confirmation-details">
          <div><dt>Your look</dt><dd>{confirmation.booking.serviceName}</dd></div>
          <div><dt>Your barber</dt><dd>{confirmation.booking.barberName}</dd></div>
          <div><dt>Date</dt><dd>{new Intl.DateTimeFormat("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: zone }).format(new Date(confirmation.booking.startAt))}</dd></div>
          <div><dt>Time</dt><dd>{instantTime(confirmation.booking.startAt)}–{instantTime(confirmation.booking.endAt)} <small>SAST (UTC+2)</small></dd></div>
          <div><dt>Service price</dt><dd>R{confirmation.booking.price} · {confirmation.booking.duration} minutes</dd></div>
          <div><dt>Area</dt><dd>{confirmation.booking.location}</dd></div>
        </dl>
        <div className="booking-calendar-actions"><a className="booking-button" href={confirmation.googleCalendarUrl} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a><a className="booking-button booking-button-outline" href={confirmation.icsUrl} target="_blank" rel="noopener noreferrer">Add to Apple Calendar</a></div>
        <button className="booking-text-button" type="button" onClick={resetBooking}>Make another booking</button>
      </div> : <>
        <ol className="booking-progress" aria-label="Booking progress">{steps.map((label, index) => <li key={label} className={index === step ? "is-current" : index < step ? "is-complete" : ""}><button type="button" onClick={() => goTo(index)} disabled={index > step || submitting} aria-current={index === step ? "step" : undefined}><span className="booking-step-number">{index < step ? "✓" : `0${index + 1}`}</span><span>{label}</span></button></li>)}</ol>
        <div className="booking-layout"><div className="booking-main">
          <div className="booking-step-heading"><span className="booking-eyebrow">STEP {String(step + 1).padStart(2, "0")} / 05</span><h3 ref={heading} tabIndex={-1}>{["Find your person.", "Choose your look.", "Pick your moment.", "A little about you.", "Looking good. Let’s confirm."][step]}</h3><p>{["Every barber offers every style on our menu.", "Thoughtful grooming. Straightforward prices.", "All appointments are in South African time (SAST / UTC+2).", "Your details stay with your booking. No account needed.", "Check the details below before saving your appointment."][step]}</p></div>
          {submitError && <div className="booking-alert" role="alert">{submitError}</div>}
          {step === 0 && <>
            {service && <p className="booking-preselected"><span aria-hidden="true">✓</span> {service.name} selected · First, choose your barber.</p>}
            <div className="booking-barbers" role="group" aria-label="Choose a barber">
              {BARBERS.map((item) => <button type="button" key={item.id} aria-pressed={barberId === item.id} className={`booking-barber ${barberId === item.id ? "is-selected" : ""}`} onClick={() => { setBarberId(item.id); setTime(""); }}><div className="booking-barber-image"><img src={item.image} alt="" loading="lazy" /><span className="booking-choice-mark" aria-hidden="true">{barberId === item.id ? "✓" : "+"}</span></div><strong>{item.name}</strong><span>{item.description}</span></button>)}
              <button type="button" aria-pressed={barberId === "first-available"} className={`booking-barber booking-barber-any ${barberId === "first-available" ? "is-selected" : ""}`} onClick={() => { setBarberId("first-available"); setTime(""); }}><div className="booking-barber-image"><Hourglass /><span className="booking-choice-mark" aria-hidden="true">{barberId === "first-available" ? "✓" : "+"}</span></div><strong>First Available</strong><span>A little flexibility. The first available pair of expert hands.</span></button>
            </div>
            <div className="booking-actions"><span className="booking-helper">Choose one to continue</span><button className="booking-button" type="button" disabled={!hydrated || !barberId} onClick={() => goTo(1)}>Choose your service</button></div>
          </>}
          {step === 1 && <>
            <div className="booking-services" role="group" aria-label="Choose a service">{SERVICES.map((item) => <button type="button" className={`booking-service ${serviceId === item.id ? "is-selected" : ""}`} key={item.id} aria-pressed={serviceId === item.id} onClick={() => { setServiceId(item.id); setTime(""); }}><span className="booking-service-top"><strong>{item.name}</strong><span className="booking-choice-mark" aria-hidden="true">{serviceId === item.id ? "✓" : "+"}</span></span><span className="booking-service-description">{item.description}</span><span className="booking-service-bottom"><strong>R{item.price}</strong><span>{item.duration} min</span></span></button>)}</div>
            <div className="booking-actions"><button className="booking-text-button" type="button" onClick={() => goTo(0)}>Back</button><button className="booking-button" type="button" disabled={!serviceId} onClick={() => goTo(2)}>Find a time</button></div>
          </>}
          {step === 2 && <>
            <div className="booking-date-layout"><div className="booking-calendar"><div className="booking-month"><button type="button" aria-label="Previous month" disabled={month <= today.slice(0, 7)} onClick={() => shiftMonth(-1)}>Previous</button><h4 aria-live="polite">{monthTitle}</h4><button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}>Next</button></div><div className="booking-weekdays" aria-hidden="true">{["M", "T", "W", "T", "F", "S", "S"].map((label, index) => <span key={index}>{label}</span>)}</div><div className="booking-days" role="group" aria-label="Choose your appointment date">{calendarDays.map(({ day, iso, inMonth }) => <button key={iso} type="button" disabled={!inMonth || iso < today || day.getDay() === 0} className={`${date === iso ? "is-selected" : ""} ${iso === today ? "is-today" : ""} ${!inMonth ? "is-outside" : ""}`} aria-label={`${dateLabel(iso)}${day.getDay() === 0 ? ", closed" : ""}${iso === today ? ", today" : ""}`} aria-pressed={date === iso} onClick={() => chooseDate(iso)}>{day.getDate()}</button>)}</div><p className="booking-calendar-note">Mon–Fri 09:00–18:00 · Sat 08:00–16:00<br />Sundays are for slowing down. We’re closed.</p></div>
              <div className="booking-times"><h4>{date ? new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`)) : "Available times"}</h4>{!date ? <p className="booking-empty">Pick a date on the calendar to discover your next available moment.</p> : loadingSlots ? <p className="booking-empty" role="status"><span className="booking-spinner" /> Finding available appointments…</p> : slotsError ? <div className="booking-empty"><p role="alert">{slotsError}</p><button type="button" className="booking-text-button" onClick={() => setRefresh((value) => value + 1)}>Try again ↻</button></div> : slots.length ? <><p className="booking-slot-help">{service?.duration} minute appointments · SAST</p><div className="booking-slot-grid" role="group" aria-label="Choose a start time">{slots.map((slot) => <button key={slot.time} type="button" aria-pressed={time === slot.time} className={time === slot.time ? "is-selected" : ""} onClick={() => setTime(slot.time)}>{slot.time}</button>)}</div></> : <p className="booking-empty" role="status">No appointments are available on this day. Try another date{barberId !== "first-available" ? " or choose First Available" : ""}.</p>}</div>
            </div>
            <div className="booking-actions"><button className="booking-text-button" type="button" onClick={() => goTo(1)}>Back</button><button className="booking-button" type="button" disabled={!date || !time || loadingSlots || !!slotsError} onClick={() => goTo(3)}>Your details</button></div>
          </>}
          {step === 3 && <form onSubmit={(event) => {
            event.preventDefault();
            const phone = details.phone.replace(/[\s()-]/g, "");
            if (!/^(?:0[1-8]\d{8}|\+27[1-8]\d{8})$/.test(phone)) {
              setSubmitError("Enter a valid South African phone number, such as 076 532 2261 or +27 76 532 2261.");
              return;
            }
            if (!details.firstName.trim() || !details.surname.trim()) { setSubmitError("Please enter your first name and surname."); return; }
            setDetails({ ...details, firstName: details.firstName.trim(), surname: details.surname.trim(), phone, email: details.email.trim() });
            goTo(4);
          }}>
            <div className="booking-fields"><label>First name <span aria-hidden="true">*</span><input autoComplete="given-name" name="firstName" value={details.firstName} minLength={1} maxLength={80} required onChange={(event) => setDetails({ ...details, firstName: event.target.value })} /></label><label>Surname <span aria-hidden="true">*</span><input autoComplete="family-name" name="surname" value={details.surname} minLength={1} maxLength={80} required onChange={(event) => setDetails({ ...details, surname: event.target.value })} /></label><label>South African phone <span aria-hidden="true">*</span><input autoComplete="tel" type="tel" inputMode="tel" name="phone" value={details.phone} pattern="(?:0|\+27)[\s\-]*[1-8][0-9\s\-]{8,13}" title="Use a South African number, such as 076 532 2261 or +27 76 532 2261." maxLength={20} required placeholder="076 532 2261" onChange={(event) => setDetails({ ...details, phone: event.target.value })} /><small>Start with 0 or +27.</small></label><label>Email address <span aria-hidden="true">*</span><input autoComplete="email" type="email" name="email" value={details.email} maxLength={254} required placeholder="you@example.com" onChange={(event) => setDetails({ ...details, email: event.target.value })} /><small>Saved with your booking; no email is sent.</small></label></div>
            <p className="booking-note">We collect only the details needed for this appointment. Read our <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
            <div className="booking-actions"><button className="booking-text-button" type="button" onClick={() => goTo(2)}>Back</button><button className="booking-button" type="submit">Review appointment</button></div>
          </form>}
          {step === 4 && <>
            <div className="booking-review"><div className="booking-review-row"><span>Service</span><strong>{service?.name} <small>R{service?.price} · {service?.duration} min</small></strong><button type="button" onClick={() => goTo(1)} aria-label="Change service">Edit</button></div><div className="booking-review-row"><span>Barber</span><strong>{barber?.name || "First Available"}{barberId === "first-available" && <small>Your barber is assigned when you book.</small>}</strong><button type="button" onClick={() => goTo(0)} aria-label="Change barber">Edit</button></div><div className="booking-review-row"><span>When</span><strong>{dateLabel(date)}<small>{time}{selectedSlot ? `–${instantTime(selectedSlot.endAt)}` : ""} · South African time</small></strong><button type="button" onClick={() => goTo(2)} aria-label="Change date and time">Edit</button></div><div className="booking-review-row"><span>Who</span><strong>{details.firstName} {details.surname}<small>{details.phone}<br />{details.email}</small></strong><button type="button" onClick={() => goTo(3)} aria-label="Change contact details">Edit</button></div><div className="booking-review-row"><span>Where</span><strong>Observatory, Cape Town<small>Lower Main Road area</small></strong></div></div>
            <label className="booking-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Booking Terms</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. </span></label>
            <div className="booking-actions"><button className="booking-text-button" type="button" disabled={submitting} onClick={() => goTo(3)}>Back</button><button className="booking-button" type="button" disabled={!consent || submitting} onClick={saveBooking}>{submitting ? <><span className="booking-spinner" /> Saving appointment…</> : <>Confirm booking</>}</button></div>
          </>}
        </div><aside className="booking-summary" aria-label="Appointment summary"><span className="booking-eyebrow">A MOMENT, JUST FOR YOU</span><h4>Your next<br /><em>chapter.</em></h4><dl><div><dt>Barber</dt><dd>{barber?.name || (barberId === "first-available" ? "First Available" : "Your choice")}</dd></div><div><dt>Service</dt><dd>{service?.name || "Something fresh"}</dd></div><div><dt>When</dt><dd>{date ? new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`)) : "A day that suits you"}{time ? ` · ${time}` : ""}</dd></div></dl><div className="booking-summary-price"><span>{service ? `${service.duration} MINUTES OF YOU TIME` : "A CUT OF DISTINCTION."}</span><strong>{service ? `R${service.price}` : "IVORY"}</strong></div><p></p><div className="booking-summary-line" aria-hidden="true" /></aside></div>
      </>}
    </div>
  </section>;
}

