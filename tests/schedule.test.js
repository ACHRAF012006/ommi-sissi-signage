import {test} from 'node:test';
import assert from 'node:assert/strict';
import {storeStatus,itemActive,zonedParts} from '../services/scheduleService.js';
const store={enabled:1,closed_screen_enabled:1,timezone:'Africa/Tunis'};
const hours=Array.from({length:7},(_,day_of_week)=>({day_of_week,is_closed:day_of_week===0,opening_time:'09:00',closing_time:'20:00'}));
test('Monday 15:00 open, Monday 22:00 closed, resumes at 09:00 Tunis independently of host timezone',()=>{
 assert.equal(storeStatus(store,hours,[],new Date('2026-10-05T14:00:00Z')).open,true);
 const closed=storeStatus(store,hours,[],new Date('2026-10-05T21:00:00Z'));assert.equal(closed.open,false);assert.deepEqual(closed.nextOpening,{date:'2026-10-06',time:'09:00'});
 assert.equal(storeStatus(store,hours,[],new Date('2026-10-06T08:00:00Z')).open,true);
 assert.equal(zonedParts(new Date('2026-10-05T23:15:00Z'),'Africa/Tunis').date,'2026-10-06');
});
test('Sunday closure, exceptions, overnight opening and explicit holiday closure',()=>{
 const sun=storeStatus(store,hours,[],new Date('2026-10-04T14:00:00Z'));assert.deepEqual(sun.nextOpening,{date:'2026-10-05',time:'09:00'});
 const exceptions=[{date:'2026-10-05',is_closed:1}];assert.equal(storeStatus(store,hours,exceptions,new Date('2026-10-05T14:00:00Z')).open,false);
 const night=hours.map(h=>({...h,is_closed:0,opening_time:'20:00',closing_time:'02:00'}));assert.equal(storeStatus(store,night,[],new Date('2026-10-06T00:00:00Z')).open,true);
 assert.equal(storeStatus(store,night,[{date:'2026-10-06',is_closed:1}],new Date('2026-10-06T00:00:00Z')).open,false);
});
test('playlist date bounds, daily windows, overnight windows and disabled items',()=>{
 const i={enabled:1,start_date:'2027-09-01',end_date:'2027-09-30',start_time:'09:00',end_time:'12:00'};
 assert.equal(itemActive(i,new Date('2027-09-15T09:00:00Z'),'Africa/Tunis'),true);
 assert.equal(itemActive(i,new Date('2027-09-15T11:00:00Z'),'Africa/Tunis'),false);
 assert.equal(itemActive(i,new Date('2027-08-31T09:00:00Z'),'Africa/Tunis'),false);
 assert.equal(itemActive({...i,enabled:0},new Date('2027-09-15T09:00:00Z'),'Africa/Tunis'),false);
 assert.equal(itemActive({enabled:1,start_time:'22:00',end_time:'02:00'},new Date('2026-10-06T00:00:00Z'),'Africa/Tunis'),true);
});

test('closing-time information follows the current overnight shift and exceptional opening hours',()=>{
 const night=hours.map(h=>({...h,is_closed:0,opening_time:h.day_of_week===1?'20:00':'09:00',closing_time:h.day_of_week===1?'02:00':'20:00'}));
 const overnight=storeStatus(store,night,[],new Date('2026-10-06T00:00:00Z'));assert.equal(overnight.open,true);assert.equal(overnight.currentHours.closing_time,'02:00');
 const special=storeStatus(store,hours,[{date:'2026-10-05',is_closed:0,opening_time:'10:00',closing_time:'18:30'}],new Date('2026-10-05T14:00:00Z'));assert.equal(special.currentHours.closing_time,'18:30');
});
