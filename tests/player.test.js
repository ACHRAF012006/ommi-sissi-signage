import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlaybackEngine} from '../public/js/playbackEngine.js';
class Clock {
 constructor(){this.now=0;this.tasks=new Map();this.serial=0;}
 setTimeout=(fn,ms)=>{const id=++this.serial;this.tasks.set(id,{fn,at:this.now+ms});return id;};
 clearTimeout=id=>this.tasks.delete(id);
 tick(ms){const target=this.now+ms;while(true){const next=[...this.tasks].filter(([,x])=>x.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;this.now=next[1].at;this.tasks.delete(next[0]);next[1].fn();}this.now=target;}
}
function harness(items){const clock=new Clock(),events=[];const renderer={show(item,cb){this.cb=cb;events.push({id:item.id,time:clock.now});cb.ready();},preload(){},clear(){}};const engine=new PlaybackEngine({renderer,getItems:s=>s.items,timer:clock});engine.stage({items});return {clock,renderer,engine,events};}
const items=[{id:1,type:'image',image_duration_seconds:5},{id:2,type:'video',video_duration:97},{id:3,type:'image',image_duration_seconds:8},{id:4,type:'video',video_duration:20}];
test('exact playlist 5s image → entire 97s video → 8s image → entire 20s video → loop',()=>{
 const {clock,renderer,engine,events}=harness(items);clock.tick(4999);assert.equal(engine.current.id,1);clock.tick(1);assert.equal(engine.current.id,2);
 for(let i=0;i<96;i++){clock.tick(1000);assert.equal(engine.current.id,2);assert.equal(clock.tasks.size,0);}
 clock.tick(1000);renderer.cb.ended();assert.equal(engine.current.id,3);clock.tick(7999);assert.equal(engine.current.id,3);clock.tick(1);assert.equal(engine.current.id,4);
 clock.tick(20000);assert.equal(engine.current.id,4);renderer.cb.ended();assert.equal(engine.current.id,1);assert.deepEqual(events,[{id:1,time:0},{id:2,time:5000},{id:3,time:102000},{id:4,time:110000},{id:1,time:130000}]);engine.destroy();assert.equal(clock.tasks.size,0);
});
test('live updates stay pending until current video ended, stale callbacks cannot advance playback',()=>{
 const {clock,renderer,engine}=harness(items);clock.tick(5000);const old=renderer.cb;engine.stage({items:[{id:8,type:'image',image_duration_seconds:9}]});clock.tick(90000);assert.equal(engine.current.id,2);old.ended();assert.equal(engine.current.id,8);old.ended();assert.equal(engine.current.id,8);engine.destroy();
});
test('broken media skips, pause cancels timers, repeated updates and resume do not leak timers',()=>{
 const {clock,renderer,engine}=harness(items);renderer.cb.failed();clock.tick(1500);assert.equal(engine.current.id,2);engine.pause();clock.tick(200000);assert.equal(engine.current,null);engine.resume();assert.equal(engine.current.id,1);assert.equal(clock.tasks.size,1);engine.destroy();assert.equal(clock.tasks.size,0);
});

test('a closed screen resumes with the latest snapshot after updates received while paused',()=>{
 const {clock,engine}=harness(items);clock.tick(5000);engine.stage({items:[{id:7,type:'image',image_duration_seconds:4}]});engine.pause();engine.stage({items:[{id:9,type:'image',image_duration_seconds:6}]});engine.resume();assert.equal(engine.current.id,9);engine.destroy();
});
