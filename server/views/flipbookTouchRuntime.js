// Own touch input so a slow swipe is not discarded by PageFlip's 250ms cutoff.
// Convert screen coordinates back to engine coordinates after zoom/fullscreen scaling.
module.exports = `
function installBookTouch(){
  let gesture=null;
  function position(touch){
    const surface=pageFlip.getUI().getDistElement();
    const rect=surface.getBoundingClientRect();
    return {x:(touch.clientX-rect.left)*surface.offsetWidth/rect.width,y:(touch.clientY-rect.top)*surface.offsetHeight/rect.height};
  }
  function cancelGesture(){
    if(gesture?.dragging){
      pageFlip.userMove(gesture.start,true);
      pageFlip.userStop(gesture.start);
    }
    gesture=null;
  }
  bookEl.addEventListener('touchstart',event=>{
    event.stopImmediatePropagation();
    cancelGesture();
    if(event.touches.length!==1||readerStage.classList.contains('is-zoomed')||pageFlip.getState()==='flipping')return;
    const touch=event.touches[0];
    gesture={id:touch.identifier,start:position(touch),screenX:touch.clientX,screenY:touch.clientY,dragging:false};
    ensureAudio();
  },{capture:true,passive:true});
  bookEl.addEventListener('touchmove',event=>{
    event.stopImmediatePropagation();
    if(!gesture)return;
    if(event.touches.length!==1){cancelGesture();return}
    const touch=Array.from(event.touches).find(t=>t.identifier===gesture.id);
    if(!touch)return;
    const dx=touch.clientX-gesture.screenX,dy=touch.clientY-gesture.screenY;
    if(!gesture.dragging&&Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){
      pageFlip.startUserTouch(gesture.start);
      gesture.dragging=true;
    }
    if(gesture.dragging){
      if(event.cancelable)event.preventDefault();
      pageFlip.userMove(position(touch),true);
    }
  },{capture:true,passive:false});
  bookEl.addEventListener('touchend',event=>{
    event.stopImmediatePropagation();
    if(!gesture)return;
    const touch=Array.from(event.changedTouches).find(t=>t.identifier===gesture.id);
    if(!touch)return;
    const dx=touch.clientX-gesture.screenX,dy=touch.clientY-gesture.screenY;
    const pos=position(touch);
    const swipe=Math.abs(dx)>=30&&Math.abs(dx)>Math.abs(dy)*1.25;
    if(event.cancelable)event.preventDefault();
    if(swipe){
      pageFlip.userStop(pos,true);
      const corner=gesture.start.y<pageFlip.getBoundsRect().height/2?'top':'bottom';
      if(dx<0&&!nextBtn.disabled)pageFlip.flipNext(corner);
      else if(dx>0&&!prevBtn.disabled)pageFlip.flipPrev(corner);
      else if(gesture.dragging){pageFlip.userMove(gesture.start,true);pageFlip.getFlipController().stopMove()}
    }else if(gesture.dragging)pageFlip.userStop(pos);
    else if(Math.abs(dx)<10&&Math.abs(dy)<10){pageFlip.startUserTouch(pos);pageFlip.userStop(pos)}
    gesture=null;
  },{capture:true,passive:false});
  bookEl.addEventListener('touchcancel',event=>{event.stopImmediatePropagation();cancelGesture()},{capture:true,passive:true});
}
`;
