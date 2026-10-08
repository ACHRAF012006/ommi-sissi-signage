export class MediaRenderer {
 constructor(stage,{onError=()=>{}}={}){this.stage=stage;this.onError=onError;this.slot=null;this.active=null;this.retiring=null;this.preloaded=null;this.cleanupCallbacks=[];this.transitionTimer=null;this.transitionFrame=null;this.watchdog=null;}
 make(item){const element=document.createElement(item.type==='video'?'video':'img');if(item.type==='video'){element.muted=true;element.playsInline=true;element.preload='auto';element.loop=false;}else element.alt=item.title||'';element.src=item.url;return element;}
 release(element){if(!element)return;if(element.tagName==='VIDEO'){element.pause();element.removeAttribute('src');element.load();}else element.removeAttribute('src');element.remove();}
 preload(item){
  if(this.preloaded?.item.url===item.url)return;
  if(this.preloaded)this.release(this.preloaded.element);
  const element=this.make(item);
  // Detached element: at most one next video, no growing object-URL or buffer cache.
  this.preloaded={item,element};
 }
 show(item,callbacks){
  const slot=document.createElement('div');slot.className=`media-slot ${item.fit==='cover'?'cover':''}`;
  if(item.type==='image'&&item.fit!=='cover'){const backdrop=document.createElement('div');backdrop.className='backdrop';backdrop.style.backgroundImage=`url("${item.url}")`;slot.append(backdrop);}
  let element;if(this.preloaded?.item.url===item.url){element=this.preloaded.element;this.preloaded=null;}else element=this.make(item);
  this.active=element;this.slot=slot;slot.append(element);this.stage.append(slot);
  let failed=false,shown=false;const fail=()=>{if(failed)return;failed=true;this.onError(item);callbacks.failed();};
  const ready=()=>{
   if(shown||failed||this.slot!==slot)return;shown=true;clearTimeout(loadTimer);
   const previous=this.retiring;
   if(previous)previous.classList.remove('is-first');else slot.classList.add('is-first');
   // Commit both starting positions before animating preloaded media.
   slot.getBoundingClientRect();previous?.getBoundingClientRect();
   this.transitionFrame=requestAnimationFrame(()=>{
    this.transitionFrame=null;if(this.slot!==slot)return;
    slot.classList.add('visible');
    if(previous){
     previous.classList.remove('visible');previous.classList.add('departing');
     const finish=()=>{
      if(this.retiring!==previous)return;
      clearTimeout(this.transitionTimer);this.transitionTimer=null;
      this.release(previous.querySelector('video,img'));previous.remove();this.retiring=null;
     };
     const ended=event=>{if(event.target===slot&&event.propertyName==='transform')finish();};
     slot.addEventListener('transitionend',ended);
     this.cleanupCallbacks.push(()=>slot.removeEventListener('transitionend',ended));
     // Reduced motion and interrupted transitions may not emit transitionend.
     const duration=Math.max(...getComputedStyle(slot).transitionDuration.split(',').map(value=>parseFloat(value)*(value.trim().endsWith('ms')?1:1000)));
     this.transitionTimer=setTimeout(finish,duration+150);
    }
    callbacks.ready();
   });
  };
  const on=(event,fn)=>{element.addEventListener(event,fn);this.cleanupCallbacks.push(()=>element.removeEventListener(event,fn));};
  const loadTimer=setTimeout(fail,45000);this.cleanupCallbacks.push(()=>clearTimeout(loadTimer));on('error',fail);
  if(item.type==='image'){on('load',ready);if(element.complete){element.naturalWidth?ready():fail();}}
  else{
   element.currentTime=0;on('ended',callbacks.ended);on('playing',ready);
   // A stall watchdog measures lack of progress, never total video duration.
   let lastPosition=0,lastProgress=Date.now();on('timeupdate',()=>{if(element.currentTime>lastPosition){lastPosition=element.currentTime;lastProgress=Date.now();}});
   this.watchdog=setInterval(()=>{if(shown&&!element.ended&&Date.now()-lastProgress>60000)fail();},15000);
   element.play().then(ready).catch(fail);
  }
 }
 clear(){
  for(const clean of this.cleanupCallbacks)clean();this.cleanupCallbacks=[];clearInterval(this.watchdog);this.watchdog=null;clearTimeout(this.transitionTimer);this.transitionTimer=null;if(this.transitionFrame!==null)cancelAnimationFrame(this.transitionFrame);this.transitionFrame=null;
  if(this.retiring){this.release(this.retiring.querySelector('video,img'));this.retiring.remove();this.retiring=null;}
  if(this.slot){if(this.active?.tagName==='VIDEO'){this.active.pause();}this.retiring=this.slot;this.slot=null;this.active=null;}
 }
 suspend(){if(this.retiring){this.release(this.retiring.querySelector('video,img'));this.retiring.remove();this.retiring=null;}if(this.preloaded)this.release(this.preloaded.element);this.preloaded=null;}
 destroy(){this.clear();if(this.retiring){this.release(this.retiring.querySelector('video,img'));this.retiring.remove();this.retiring=null;}if(this.preloaded)this.release(this.preloaded.element);this.preloaded=null;}
}
