'use strict';
const mainVideo=document.getElementById('main-video');
document.querySelectorAll('[data-seek]').forEach(button=>button.addEventListener('click',()=>{const go=()=>{mainVideo.currentTime=Number(button.dataset.seek);mainVideo.play().catch(()=>{});};if(mainVideo.readyState>=1)go();else mainVideo.addEventListener('loadedmetadata',go,{once:true});mainVideo.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});}));
const dialog=document.getElementById('figure-dialog'),expanded=document.getElementById('expanded-image'),caption=document.getElementById('expanded-caption');
const expandedVideo=document.getElementById('expanded-video');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const animationStates=new Map();

function loadAnimation(video){
  const source=video.querySelector('source[data-src]');
  if(source){source.src=source.dataset.src;delete source.dataset.src;video.load();}
}
function updateAnimationButton(video){
  const state=animationStates.get(video),playing=!video.paused&&!video.ended;
  state.button.setAttribute('aria-label',`${playing?'Pause':'Play'} ${state.label}`);
  state.button.title=playing?'Pause animation':'Play animation';
  state.button.querySelector('[data-play-icon]').hidden=playing;
  state.button.querySelector('[data-pause-icon]').hidden=!playing;
}
function shouldPlay(video){
  const state=animationStates.get(video);
  return state.visible&&!state.userPaused&&!document.hidden&&!dialog.open&&(!reducedMotion.matches||state.manualPlay);
}
function refreshAnimation(video){
  const state=animationStates.get(video);
  if(!shouldPlay(video)){state.resumeRequested=false;video.pause();return;}
  loadAnimation(video);
  if(!video.paused)return;
  if(state.pending){state.resumeRequested=true;return;}
  state.pending=true;
  video.play().then(()=>{if(!shouldPlay(video))video.pause();}).catch(()=>{}).finally(()=>{
    state.pending=false;updateAnimationButton(video);
    const resume=state.resumeRequested;state.resumeRequested=false;
    if(resume&&shouldPlay(video)&&video.paused)refreshAnimation(video);
  });
}
function refreshAnimations(){animationStates.forEach((state,video)=>refreshAnimation(video));}

document.querySelectorAll('[data-scroll-animation]').forEach(video=>{
  const button=document.querySelector(`[data-animation-toggle="${video.id}"]`);
  video.muted=true;
  animationStates.set(video,{button,label:button.getAttribute('aria-label').replace(/^Play /,''),visible:false,userPaused:false,manualPlay:false,pending:false,resumeRequested:false});
  ['play','pause','ended'].forEach(event=>video.addEventListener(event,()=>updateAnimationButton(video)));
  button.addEventListener('click',()=>{
    const state=animationStates.get(video);
    if(!video.paused){state.userPaused=true;video.pause();}
    else{state.userPaused=false;state.manualPlay=true;state.visible=true;refreshAnimation(video);}
  });
});

if('IntersectionObserver' in window){
  const preloadObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting&&!reducedMotion.matches){loadAnimation(entry.target);preloadObserver.unobserve(entry.target);}
  }),{rootMargin:'450px 0px'});
  const playbackObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    const video=entry.target,state=animationStates.get(video);
    state.visible=entry.isIntersecting&&entry.intersectionRatio>=.25;
    refreshAnimation(video);
  }),{rootMargin:'-84px 0px 0px',threshold:[0,.25]});
  animationStates.forEach((state,video)=>{preloadObserver.observe(video);playbackObserver.observe(video);});
}
reducedMotion.addEventListener('change',()=>{
  animationStates.forEach(state=>{state.manualPlay=false;});
  refreshAnimations();
});

document.querySelectorAll('[data-image]').forEach(button=>button.addEventListener('click',()=>{
  expandedVideo.hidden=true;expanded.hidden=false;
  expanded.src=button.dataset.image;expanded.alt=button.querySelector('img').alt;
  caption.textContent=button.dataset.caption;dialog.showModal();refreshAnimations();
}));
document.querySelectorAll('[data-video]').forEach(button=>button.addEventListener('click',()=>{
  const sourceVideo=document.getElementById(button.dataset.video);
  loadAnimation(sourceVideo);
  expanded.hidden=true;expandedVideo.hidden=false;
  expandedVideo.poster=sourceVideo.poster;expandedVideo.src=sourceVideo.querySelector('source').src;
  expandedVideo.setAttribute('aria-label',sourceVideo.getAttribute('aria-label'));
  caption.textContent=button.dataset.caption;dialog.showModal();refreshAnimations();
  expandedVideo.play().catch(()=>{});
}));
document.getElementById('close-figure').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
dialog.addEventListener('close',()=>{expandedVideo.pause();expandedVideo.removeAttribute('src');expandedVideo.load();refreshAnimations();});
document.getElementById('copy-citation').addEventListener('click',async()=>{const button=document.getElementById('copy-citation'),status=document.getElementById('copy-status');try{await navigator.clipboard.writeText(document.getElementById('bibtex').textContent);button.textContent='Copied ✓';status.textContent='Citation copied to clipboard.';setTimeout(()=>{button.textContent='Copy citation';status.textContent='';},2500);}catch{const selection=getSelection(),range=document.createRange();range.selectNodeContents(document.getElementById('bibtex'));selection.removeAllRanges();selection.addRange(range);status.textContent='Citation selected. Copy with your keyboard.';button.textContent='Citation selected';}});
document.querySelectorAll('a[href="#team"]').forEach(link=>link.addEventListener('click',()=>{document.getElementById('team').open=true;}));
document.addEventListener('visibilitychange',()=>{if(document.hidden){document.querySelectorAll('video').forEach(video=>video.pause());}else refreshAnimations();});
