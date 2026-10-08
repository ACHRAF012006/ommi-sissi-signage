// The only image timer is created after the renderer confirms the image is visible.
// Videos advance exclusively on ended, or on a renderer-reported load/play failure.
export class PlaybackEngine {
 constructor({renderer,getItems,onEmpty=()=>{},onItem=()=>{},timer={setTimeout:(fn,ms)=>globalThis.setTimeout(fn,ms),clearTimeout:id=>globalThis.clearTimeout(id)}}) {
  Object.assign(this,{renderer,getItems,onEmpty,onItem,timer});this.snapshot=null;this.pending=null;this.current=null;this.index=-1;this.imageTimer=null;this.failureTimer=null;this.version=0;this.paused=false;this.running=false;
 }
 stage(snapshot){
  if(!this.snapshot||!this.running){this.snapshot=snapshot;this.pending=null;if(!this.paused)this.next();}
  else this.pending=snapshot;
 }
 next(){
  if(this.paused)return;
  const previous=this.current;
  this.cancelTimers();this.renderer.clear();this.version++;
  if(this.pending){this.snapshot=this.pending;this.pending=null;}
  const items=this.getItems(this.snapshot);this.running=true;
  if(!items.length){this.current=null;this.index=-1;this.running=false;this.onEmpty();return;}
  const last=previous?items.findIndex(x=>x.id===previous.id):-1;
  this.index=last>=0?(last+1)%items.length:0;this.current=items[this.index];
  const version=this.version,item=this.current;this.onItem(item);
  const failed=()=>{if(version!==this.version||this.paused||this.failureTimer!==null)return;this.cancelTimers();this.failureTimer=this.timer.setTimeout(()=>{this.failureTimer=null;this.next();},1500);};
  this.renderer.show(item,{
   ready:()=>{if(version!==this.version||this.paused)return;if(item.type==='image')this.imageTimer=this.timer.setTimeout(()=>this.next(),item.image_duration_seconds*1000);},
   ended:()=>{if(version===this.version&&item.type==='video'&&!this.paused)this.next();},
   failed
  });
  this.renderer.preload(items[(this.index+1)%items.length]);
 }
 pause(){this.paused=true;this.running=false;this.version++;this.cancelTimers();this.renderer.clear();this.renderer.suspend?.();this.current=null;}
 resume(snapshot=this.snapshot){if(!this.paused&&this.running)return;this.paused=false;this.snapshot=this.pending||snapshot;this.pending=null;this.next();}
 cancelTimers(){for(const key of ['imageTimer','failureTimer']){if(this[key]!==null)this.timer.clearTimeout(this[key]);this[key]=null;}}
 destroy(){this.pause();this.renderer.destroy?.();}
}
