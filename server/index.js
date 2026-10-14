import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-this-secret-before-deploying';
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));

const seedMovies = [
  { id:'m1', title:'Dune: Part Two', genre:'Sci-Fi / Adventure', duration:166, rating:'8.5', language:'English', certificate:'UA', releaseYear:2024, poster:'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', synopsis:'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.' },
  { id:'m2', title:'Interstellar', genre:'Sci-Fi / Drama', duration:169, rating:'8.7', language:'English', certificate:'UA', releaseYear:2014, poster:'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', synopsis:'A team of explorers travels beyond this galaxy to discover whether mankind has a future among the stars.' },
  { id:'m3', title:'Spider-Man: Across the Spider-Verse', genre:'Animation / Action', duration:140, rating:'8.6', language:'English', certificate:'U/A', releaseYear:2023, poster:'https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg', synopsis:'Miles Morales swings across the multiverse and meets a team of Spider-People charged with protecting its existence.' },
  { id:'m4', title:'The Batman', genre:'Action / Crime', duration:176, rating:'7.8', language:'English', certificate:'UA', releaseYear:2022, poster:'https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg', synopsis:'Batman ventures into Gotham City’s underworld when a sadistic killer leaves behind a trail of cryptic clues.' },
  { id:'m5', title:'Oppenheimer', genre:'Biography / Drama', duration:180, rating:'8.3', language:'English', certificate:'UA', releaseYear:2023, poster:'https://image.tmdb.org/t/p/w500/ptpr0kGAckfQkJeJIt8st5dglvd.jpg', synopsis:'The story of J. Robert Oppenheimer and his role in the development of the atomic bomb.' },
  { id:'m6', title:'Jawan', genre:'Action / Thriller', duration:169, rating:'7.0', language:'Hindi', certificate:'UA', releaseYear:2023, poster:'https://image.tmdb.org/t/p/w500/jFt1gS4BGHlK8xt76Y81Alp4dbt.jpg', synopsis:'A man driven by a personal vendetta rights the wrongs of society in a high-octane action thriller.' }
];
const venues = [
  { id:'v1', name:'PVR Acropolis', area:'Thaltej, Ahmedabad' },
  { id:'v2', name:'INOX Gandhinagar', area:'Sector 21, Gandhinagar' },
  { id:'v3', name:'Cinepolis Nexus', area:'Vastrapur, Ahmedabad' }
];
const dates = Array.from({length:5}, (_,i) => {
  const d = new Date(); d.setDate(d.getDate()+i);
  return d.toISOString().slice(0,10);
});
const shows = [];
seedMovies.forEach((movie, mi) => venues.forEach((venue, vi) => dates.forEach((date, di) => {
  ['10:30','14:00','17:30','21:00'].forEach((time, ti) => {
    shows.push({ id:`s-${movie.id}-${venue.id}-${date}-${ti}`, movieId:movie.id, venueId:venue.id, date, time, screen:`Screen ${1+((mi+vi)%4)}`, price: (180 + ti*40 + (vi===0?20:0)), seats: 60 });
  });
})));
function initialDb() {
  return { users:[], movies:seedMovies, venues, shows, bookings:[] };
}
function loadDb() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { const db = initialDb(); saveDb(db); return db; }
}
let db = loadDb();
function saveDb(next=db) { fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2)); }
function safeUser(user) { return { id:user.id, name:user.name, email:user.email, role:user.role || 'user' }; }
function auth(req,res,next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'');
  if (!token) return res.status(401).json({ error:'Please sign in to continue.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error:'Your session expired. Please sign in again.' }); }
}
function adminOnly(req,res,next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error:'Administrator access required.' });
  next();
}
function publicBooking(b) {
  const show=db.shows.find(s=>s.id===b.showId), movie=db.movies.find(m=>m.id===show?.movieId), venue=db.venues.find(v=>v.id===show?.venueId);
  return { ...b, movie:movie ? {id:movie.id,title:movie.title,poster:movie.poster} : null, venue, show:show ? {date:show.date,time:show.time,screen:show.screen,price:show.price} : null };
}

app.get('/api/health', (req,res)=>res.json({status:'ok', service:'CineBook API'}));
app.get('/api/movies', (req,res)=>{
  const q=(req.query.q||'').toLowerCase(), genre=(req.query.genre||'').toLowerCase();
  const movies=db.movies.filter(m=>(!q || `${m.title} ${m.genre} ${m.language}`.toLowerCase().includes(q)) && (!genre || m.genre.toLowerCase().includes(genre)));
  res.json(movies);
});
app.get('/api/movies/:id', (req,res)=>{
  const movie=db.movies.find(m=>m.id===req.params.id);
  if(!movie) return res.status(404).json({error:'Movie not found.'});
  res.json(movie);
});
app.get('/api/venues', (req,res)=>res.json(db.venues));
app.get('/api/shows', (req,res)=>{
  const {movieId, date, venueId}=req.query;
  res.json(db.shows.filter(s=>(!movieId||s.movieId===movieId)&&(!date||s.date===date)&&(!venueId||s.venueId===venueId)));
});
app.post('/api/auth/register', async (req,res)=>{
  try {
    const name=String(req.body.name||'').trim(), email=String(req.body.email||'').trim().toLowerCase(), password=String(req.body.password||'');
    if(name.length<2) return res.status(400).json({error:'Name must contain at least 2 characters.'});
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:'Enter a valid email address.'});
    if(password.length<8) return res.status(400).json({error:'Password must be at least 8 characters.'});
    if(db.users.some(u=>u.email===email)) return res.status(409).json({error:'An account with this email already exists.'});
    const user={id:crypto.randomUUID(),name,email,passwordHash:await bcrypt.hash(password,10),role:'user'};
    db.users.push(user); saveDb();
    const token=jwt.sign({id:user.id,email:user.email,role:user.role},JWT_SECRET,{expiresIn:'7d'});
    res.status(201).json({token,user:safeUser(user)});
  } catch { res.status(500).json({error:'Could not create your account.'}); }
});
app.post('/api/auth/login', async (req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase(), password=String(req.body.password||'');
  const user=db.users.find(u=>u.email===email);
  if(!user || !(await bcrypt.compare(password,user.passwordHash))) return res.status(401).json({error:'Incorrect email or password.'});
  const token=jwt.sign({id:user.id,email:user.email,role:user.role},JWT_SECRET,{expiresIn:'7d'});
  res.json({token,user:safeUser(user)});
});
app.get('/api/auth/me', auth, (req,res)=>{
  const user=db.users.find(u=>u.id===req.user.id);
  if(!user) return res.status(404).json({error:'Account not found.'});
  res.json(safeUser(user));
});
app.get('/api/bookings', auth, (req,res)=>{
  res.json(db.bookings.filter(b=>b.userId===req.user.id).map(publicBooking).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
});
app.post('/api/bookings', auth, (req,res)=>{
  const {showId,seats}=req.body;
  if(!Array.isArray(seats)||seats.length<1||seats.length>10) return res.status(400).json({error:'Select between 1 and 10 seats.'});
  if(new Set(seats).size!==seats.length || seats.some(s=>typeof s!=='string'||!/^([A-F])([1-9]|10)$/.test(s))) return res.status(400).json({error:'Seat selection is invalid.'});
  const show=db.shows.find(s=>s.id===showId);
  if(!show) return res.status(404).json({error:'Showtime not found.'});
  const alreadyBooked=db.bookings.filter(b=>b.showId===showId).flatMap(b=>b.seats);
  if(seats.some(s=>alreadyBooked.includes(s))) return res.status(409).json({error:'One or more selected seats were just booked. Please choose again.'});
  const booking={id:`CB${crypto.randomBytes(4).toString('hex').toUpperCase()}`,userId:req.user.id,showId,seats,amount:show.price*seats.length,status:'confirmed',createdAt:new Date().toISOString()};
  db.bookings.push(booking); saveDb();
  res.status(201).json(publicBooking(booking));
});
app.get('/api/shows/:id/seats', (req,res)=>{
  if(!db.shows.some(s=>s.id===req.params.id)) return res.status(404).json({error:'Showtime not found.'});
  const booked=db.bookings.filter(b=>b.showId===req.params.id).flatMap(b=>b.seats);
  res.json({booked, total:60});
});
app.get('/api/admin/summary', auth, adminOnly, (req,res)=>{
  res.json({users:db.users.length, bookings:db.bookings.length, revenue:db.bookings.reduce((sum,b)=>sum+b.amount,0), movies:db.movies.length});
});
app.post('/api/admin/movies', auth, adminOnly, (req,res)=>{
  const {title,genre,duration,language,poster,synopsis}=req.body;
  if(!title||!genre||!duration) return res.status(400).json({error:'Title, genre and duration are required.'});
  const movie={id:`m-${crypto.randomUUID()}`,title:String(title).trim(),genre:String(genre),duration:Number(duration),language:language||'English',rating:'New',certificate:'UA',releaseYear:new Date().getFullYear(),poster:poster||'',synopsis:synopsis||''};
  db.movies.unshift(movie); saveDb(); res.status(201).json(movie);
});
app.use((err,req,res,next)=>{ console.error(err); res.status(500).json({error:'Unexpected server error.'}); });
app.listen(PORT,()=>console.log(`CineBook API running at http://localhost:${PORT}`));
