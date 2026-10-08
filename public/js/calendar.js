// All calendar decisions use the store's IANA timezone, never the TV's clock zone.
export function zonedParts(now,timezone='Africa/Tunis') {
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
 const date=`${p.year}-${p.month}-${p.day}`;
 return {date,time:`${p.hour}:${p.minute}`,day:new Date(`${date}T12:00:00Z`).getUTCDay()};
}
const previousDate=d=>new Date(new Date(`${d}T12:00:00Z`).getTime()-86400000).toISOString().slice(0,10);
export function itemActive(item,now,timezone) {
 if (!item.enabled) return false;
 const {date,time}=zonedParts(now,timezone);
 if (item.start_date&&date<item.start_date || item.end_date&&date>item.end_date) return false;
 if (item.start_time&&item.end_time) return item.start_time<=item.end_time ? time>=item.start_time&&time<item.end_time : time>=item.start_time||time<item.end_time;
 return true;
}
export function storeStatus(store,hours,exceptions=[],now=new Date()) {
 const p=zonedParts(now,store.timezone);
 const dayFor=(date,day)=>exceptions.find(e=>e.date===date)||hours.find(h=>h.day_of_week===day)||{is_closed:1};
 const today=dayFor(p.date,p.day), yesterday=dayFor(previousDate(p.date),(p.day+6)%7);
 const active=h=>!h.is_closed&&h.opening_time&&h.closing_time;
 let open=false,currentHours=null;
 if (active(today)) open=today.opening_time<today.closing_time ? p.time>=today.opening_time&&p.time<today.closing_time : p.time>=today.opening_time;
 if(open)currentHours=today;
 // A closure exception for today explicitly suppresses a previous overnight shift.
 if (!exceptions.some(e=>e.date===p.date&&e.is_closed) && active(yesterday)&&yesterday.opening_time>yesterday.closing_time&&p.time<yesterday.closing_time){open=true;currentHours=yesterday;}
 let nextOpening=null;
 if (!open) for(let i=0;i<=370;i++){
   const date=new Date(new Date(`${p.date}T12:00:00Z`).getTime()+i*86400000).toISOString().slice(0,10), h=dayFor(date,(p.day+i)%7);
   if(active(h)&&(i>0||h.opening_time>p.time)){nextOpening={date,time:h.opening_time};break;}
 }
 return {open:Boolean(store.enabled&&open),today,currentHours,nextOpening,localDate:p.date,localTime:p.time,timezone:store.timezone,closedScreenEnabled:Boolean(store.closed_screen_enabled)};
}
