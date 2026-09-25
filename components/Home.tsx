'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Menu, X, MapPin, Phone, Clock3, Check } from 'lucide-react';
import Booking from './Booking';
import Preview from './Preview';
import { SERVICES } from '@/lib/catalog';

const links = [['Services','services'],['Book','book'],['Preview','preview'],['Our Story','our-story'],['Contact','contact'],['Reviews','reviews']];
const team = [
  { name: 'Ndumiso Mkhasibe', role: 'THE FOUNDER', image: 'CEO', headline: 'Good style should feel like you.', text: 'Ndumiso imagined a space where a student’s budget and a professional’s eye for detail could feel equally at home. IVORY is that idea: thoughtful grooming, honest prices and a little more confidence for whatever comes next.' },
  { name: 'Ashley', role: 'SHOP COORDINATOR', image: 'Ashley', headline: 'A warm welcome. Every time.', text: 'Ashley keeps the day flowing and makes sure everyone feels seen. A young South African Indian woman with an eye for the little details, she brings calm organisation and easy conversation to the heart of the shop.' },
  { name: 'Kylie', role: 'BARBER · PRECISION & PERSONALITY', image: 'Kylie', headline: 'The details make the difference.', text: 'Kylie brings a considered eye and an easy energy to the chair. From a clean chiskop to a carefully shaped beard, she takes time to understand how you want to look — and how you want to feel.' },
  { name: 'Pro', role: 'BARBER · CLEAN LINES, EASY ENERGY', image: 'PRO', headline: 'Fresh lines. Fresh perspective.', text: 'Pro’s approach is relaxed, his finishing precise. Whether you are keeping your signature look or trying something new, he works across the full menu to find the shape that suits your everyday life.' },
  { name: 'Steve', role: 'BARBER · SHAPE & FINISH', image: 'Steve', headline: 'Your everyday, elevated.', text: 'Steve likes a good conversation and a cut that grows out well. His patient, practical approach makes everything from a quick trim to a custom style feel simple. Every menu style is welcome in his chair.' }
];
const reviews = [
  {name:'Lwazi M.',rating:5,text:'The kind of fade that makes you take the long way home. Clean lines and a really relaxed vibe.'},
  {name:'Anika P.',rating:4.5,text:'Booked between lectures. Easy to find a time and the brush cut was exactly what I wanted.'},
  {name:'Jamie R.',rating:5,text:'Finally, a trim that actually means a trim. Steve listened, checked the length and got it right.'},
  {name:'Thabo S.',rating:4,text:'Good cut for the price. I would leave a little extra time for a chat — Pro is great company.'},
  {name:'Zara K.',rating:4.5,text:'Loved how Kylie explained what would work with my hair. Left feeling like myself, just sharper.'},
  {name:'Daniel B.',rating:3.5,text:'Happy with the beard shape. I prefer a quieter appointment, but the finish was tidy and the team friendly.'},
  {name:'Musa N.',rating:5,text:'Chiskop and a beard tidy for R150? That is my monthly grooming sorted.'},
  {name:'Ravi D.',rating:4.5,text:'Brought a reference for a custom cut. We talked through what was realistic before starting. Appreciated that.'},
  {name:'Alex J.',rating:4,text:'Simple booking, no account to create. A little busy on Saturday, but worth making the appointment.'},
  {name:'Siyanda T.',rating:5,text:'Ashley made the first visit feel familiar. Good people, a fresh cut and no fuss.'}
];

function Rating({value}:{value:number}) { return <span className="rating" role="img" aria-label={`${value} out of 5 stars`}><span aria-hidden="true">★★★★★</span><span aria-hidden="true" className="rating-fill" style={{width:`${value/5*100}%`}}>★★★★★</span></span>; }

export default function Home() {
  const [menu,setMenu] = useState(false);
  const [scrolled,setScrolled] = useState(false);
  const [selectedService,setSelectedService] = useState<string>();
  const video = useRef<HTMLVideoElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const reviewTrigger = useRef<HTMLButtonElement>(null);
  const [contactStatus,setContactStatus] = useState('');
  const [contactBusy,setContactBusy] = useState(false);
  const [reviewStatus,setReviewStatus] = useState('');
  const [reviewBusy,setReviewBusy] = useState(false);
  const [reviewSaved,setReviewSaved] = useState(false);
  const [reviewOpen,setReviewOpen] = useState(false);
  useEffect(()=>{
    const update=()=>setScrolled(window.scrollY>100); update();
    window.addEventListener('scroll',update,{passive:true});
    const mq=window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mq.matches) video.current?.play().catch(()=>{});
    const motion=()=>{if(mq.matches) video.current?.pause(); else video.current?.play().catch(()=>{})}; mq.addEventListener('change',motion);
    return ()=>{window.removeEventListener('scroll',update);mq.removeEventListener('change',motion)};
  },[]);
  useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'&&menu){setMenu(false);menuButton.current?.focus()}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[menu]);
  useEffect(()=>{if(reviewOpen) dialog.current?.focus()},[reviewOpen]);
  useEffect(()=>{if(!reviewOpen)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeReview()}};document.addEventListener('keydown',close,true);return()=>document.removeEventListener('keydown',close,true)},[reviewOpen]);
  function book(id?:string){setSelectedService(id);window.dispatchEvent(new CustomEvent('ivory:book',{detail:{serviceId:id}}));document.getElementById('book')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});history.replaceState(null,'','#book')}
  async function submitContact(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const form=e.currentTarget;setContactBusy(true);setContactStatus('');
    const values=Object.fromEntries(new FormData(form));
    try{const res=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});const data=await res.json();if(!res.ok)throw new Error(data.error||'Your message could not be saved. Please try again.');setContactStatus('Your message has been saved. Thank you for getting in touch. No email has been sent.');form.reset()}catch(error){setContactStatus(error instanceof Error?error.message:'Connection interrupted. Please try again.')}finally{setContactBusy(false)}
  }
  async function submitReview(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));setReviewBusy(true);setReviewStatus('');
    try{const res=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,rating:Number(values.rating)})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Your review could not be saved. Please try again.');setReviewSaved(true);setReviewStatus('Thank you. Your review has been saved for moderation and will not appear publicly.')}catch(error){setReviewStatus(error instanceof Error?error.message:'Connection interrupted. Please try again.')}finally{setReviewBusy(false)}
  }
  function closeReview(){setReviewOpen(false);dialog.current?.close();reviewTrigger.current?.focus()}
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className={`site-header ${scrolled?'is-scrolled':''}`}>
      <a className="header-logo" href="#home" aria-label="IVORY Barbers — Home"><img src="/media/logo.webp" width="100" height="100" alt="IVORY Barbers gold elephant logo"/></a>
      <button ref={menuButton} className="menu-toggle" onClick={()=>setMenu(!menu)} aria-label={menu?'Close navigation':'Open navigation'} aria-expanded={menu} aria-controls="main-navigation">{menu?<X/>:<Menu/>}</button>
      <nav id="main-navigation" aria-label="Main navigation" className={menu?'nav-open':''}>{links.map(([label,id])=><a key={id} href={`#${id}`} onClick={()=>setMenu(false)}>{label}</a>)}</nav>
      <a className="header-book" href="#book">BOOK A CHAIR</a>
    </header>
    <main id="main">
      <section className="hero" id="home" aria-labelledby="hero-heading">
        <video ref={video} className="hero-video" muted loop playsInline preload="none" poster="/media/hero-poster.webp" aria-hidden="true"><source src="/video/hero-web.mp4" type="video/mp4"/></video>
        <div className="hero-shade"/>
        <div className="hero-content"><p className="eyebrow"><span/> OBSERVATORY, CAPE TOWN <span/></p><h1 id="hero-heading">A CUT OF<br/><em>DISTINCTION.</em></h1><p className="hero-description">Good people. Great cuts. Your kind of place.<br/>Thoughtful grooming, without the premium price tag.</p><a className="button" href="#book">Book Now</a></div>
      </section>
      <section className="section services-section" id="services" aria-labelledby="services-heading">
        <div className="section-head"><div><h2 id="services-heading">FIND YOUR <em>LOOK.</em></h2></div><p>Fresh starts with the details.<br/>Six ways to make the chair your own.</p></div>
        <div className="services-grid">{SERVICES.map((service)=><article className="service-card" key={service.id}><div className="service-image"><img src={`/media/services/${service.id}.webp`} alt={`${service.name} haircut inspiration`} width="640" height="640" loading="lazy"/></div><div className="service-heading"><h3>{service.name}</h3><span>R{service.price}</span></div><p className="service-duration">+/- {service.duration} MINUTES</p><p className="service-description">{service.description}</p><button className="text-button" onClick={()=>book(service.id)} aria-label={`Book ${service.name}`}>Book this cut</button></article>)}</div>
        <p className="menu-note">Chiskop, Brush Cut and Fade Cut include a complimentary beard cut or trim.</p>
      </section>
      <Booking selectedService={selectedService}/>
      <Preview onBook={book}/>
      <section className="section story-section" id="our-story" aria-labelledby="story-heading">
        <div className="section-head"><div><h2 id="story-heading">ROOTED IN OBS.<br/><em>MADE FOR YOU.</em></h2></div><p>A neighbourhood spirit. An individual touch.<br/>Meet the people who make IVORY feel like home.</p></div>
        {team.map((person,index)=><article className={`story-person ${index%2?'reverse':''}`} key={person.name}><div className="portrait-wrap"><img src={`/media/team/${person.image.toLowerCase()}.webp`} alt={`${person.name}, ${person.role.toLowerCase()}`} width="800" height="800" loading="lazy"/></div><div className="story-copy"><p className="eyebrow">{person.role}</p><h3>{person.name}</h3><h4>{person.headline}</h4><p>{person.text}</p>{index>1&&<button className="text-button" onClick={()=>book()}>Find your chair</button>}</div></article>)}
      </section>
      <section className="section contact-section" id="contact" aria-labelledby="contact-heading">
        <div className="section-head"><div><h2 id="contact-heading">LET’S <em>CONNECT.</em></h2></div><p>A question about a cut? Something on your mind?<br/>There is always room for a conversation.</p></div>
        <div className="contact-grid"><div className="contact-info"><a className="phone-link" href="tel:+27765322261"><Phone size={23}/>076 532 2261</a><p className="contact-email">info@ivorybarbers.co.za <small></small></p><div className="contact-detail"><MapPin/><div><h3>IN THE HEART OF OBS</h3><p>Lower Main Road, Observatory<br/>Cape Town, 7925</p><a className="text-button" href="https://www.google.com/maps/search/?api=1&query=Observatory%2C+Cape+Town" target="_blank" rel="noreferrer">Explore the neighbourhood</a></div></div><div className="contact-detail"><Clock3/><div><h3>GOOD TIMES FOR A FRESH CUT</h3><dl className="hours"><div><dt>Monday – Friday</dt><dd>09:00 – 18:00</dd></div><div><dt>Saturday</dt><dd>08:00 – 16:00</dd></div><div><dt>Sunday</dt><dd>Closed</dd></div></dl><small>All times are South African Standard Time.</small></div></div></div>
        <form className="contact-form panel" onSubmit={submitContact}><h3>DROP US A NOTE.</h3><label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="First and last name"/></label><label>Email address<input type="email" name="email" autoComplete="email" required maxLength={254} placeholder="you@example.com"/></label><label>Your message<textarea name="message" required minLength={10} maxLength={3000} rows={5} placeholder="How can we help?"/></label><div className="honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div><p className="form-help">Messages are saved securely. See our <a href="/privacy">Privacy Policy</a>.</p><button className="button" disabled={contactBusy}>{contactBusy?'Saving your message…':'Send message'}</button><p className="form-status" role="status">{contactStatus}</p></form></div>
      </section>
      <section className="section reviews-section" id="reviews" aria-labelledby="reviews-heading"><div className="section-head"><div><p className="eyebrow">06 / WORD AROUND THE CHAIR</p><h2 id="reviews-heading">GOOD CUTS.<br/><em>GOOD COMPANY.</em></h2></div><div><p>Voices from the neighbourhood.</p><button type="button" ref={reviewTrigger} className="text-button" onClick={()=>{setReviewSaved(false);setReviewStatus('');setReviewOpen(true)}}>Leave a Review</button></div></div><div className="reviews-grid">{reviews.map(r=><article className="review-card" key={r.name}><Rating value={r.rating}/><blockquote>“{r.text}”</blockquote><div className="review-author"><span>{r.name}</span><small>Review · {r.rating}/5</small></div></article>)}</div></section>
      <section className="closing-banner"><p className="eyebrow">A LITTLE TIME FOR YOURSELF.</p><h2>YOUR NEXT CHAPTER.<br/><em>A FRESH CUT.</em></h2><a href="#book" className="button">Take a seat</a></section>
    </main>
    <footer><div className="footer-top"><div className="footer-brand"><a href="#home"><img src="/media/logo.webp" width="120" height="120" alt="IVORY Barbers"/></a><p>A Cut of Distinction.</p><small></small></div><div><h3>EXPLORE</h3><a href="#home">Home</a>{links.map(([label,id])=><a href={`#${id}`} key={id}>{label}</a>)}</div><div><h3>FIND US IN OBS</h3><a href="tel:+27765322261">076 532 2261</a><p>info@ivorybarbers.co.za<br/></p><p>Lower Main Road, Observatory<br/>Cape Town, 7925<br/></p></div><div><h3>THE DOOR IS OPEN</h3><p>Mon – Fri / 09:00 – 18:00<br/>Saturday / 08:00 – 16:00<br/>Sunday / Closed</p><a className="text-button" href="#book">Book a chair</a></div></div><div className="footer-bottom"><span>© 2026 IVORY Barbers</span><div><a href="/privacy">Privacy Policy</a><a href="/terms">Booking Terms</a></div><a href="#home">Back to Top</a></div></footer>
    <dialog tabIndex={-1} className="review-modal" ref={dialog} open={reviewOpen} aria-labelledby="review-title" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeReview()}}} onCancel={e=>{e.preventDefault();closeReview()}} onClose={()=>{setReviewOpen(false);reviewTrigger.current?.focus()}} onClick={e=>{if(e.target===e.currentTarget)closeReview()}}><div className="modal-content"><button type="button" className="modal-close" onClick={closeReview} aria-label="Close review dialog"><X/></button><p className="eyebrow">YOUR VOICE MATTERS</p><h2 id="review-title">HOW WAS <em>YOUR VISIT?</em></h2>{reviewSaved?<div className="review-success"><Check size={36}/><p role="status">{reviewStatus}</p><button type="button" className="button" onClick={closeReview}>All done</button></div>:<form onSubmit={submitReview}><p className="form-help">Your submission is saved privately as pending and is not published.</p><label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={100}/></label><label>Your rating<select name="rating" defaultValue="5" required>{[5,4.5,4,3.5,3,2.5,2,1.5,1].map(n=><option value={n} key={n}>{n} out of 5 stars</option>)}</select></label><label>Your review<textarea name="review" required minLength={10} maxLength={1500} rows={4}/></label><div className="honeypot" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" aria-label="Website"/></div><p className="form-help">By submitting, you agree to the <a href="/privacy">Privacy Policy</a>.</p><button className="button" disabled={reviewBusy}>{reviewBusy?'Saving…':'Submit review'}</button><p role="status" className="form-status">{reviewStatus}</p></form>}</div></dialog>
  </>;
}
