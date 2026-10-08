// Fit the media itself to 16:9, leaving room for the decorative border.
export function fitMedia(width,height,borderWidth=0,borderHeight=0) {
 const availableWidth=Math.max(0,width-borderWidth),availableHeight=Math.max(0,height-borderHeight);
 const mediaWidth=Math.min(availableWidth,availableHeight*16/9);
 return {width:mediaWidth,height:mediaWidth*9/16};
}
export function observePlayerLayout(viewport,content) {
 const resize=()=>{
  const styles=getComputedStyle(content);
  const borderWidth=parseFloat(styles.borderLeftWidth)+parseFloat(styles.borderRightWidth);
  const borderHeight=parseFloat(styles.borderTopWidth)+parseFloat(styles.borderBottomWidth);
  const size=fitMedia(viewport.clientWidth,viewport.clientHeight,borderWidth,borderHeight);
  content.style.width=`${size.width}px`;content.style.height=`${size.height}px`;
  content.style.setProperty('--media-unit',`${size.width/100}px`);
 };
 const observer=new ResizeObserver(resize);observer.observe(viewport);resize();
 return ()=>observer.disconnect();
}
