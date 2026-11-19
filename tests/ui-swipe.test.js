const {JSDOM}=require('jsdom');const fs=require('fs');
const path=require('path');const INDEX=process.argv[2]||path.join(__dirname,'..','deploy','Index.html');
const html=fs.readFileSync(INDEX,'utf8').replace(/<link[^>]*fonts[^>]*>/,'');
const calls=[];
const api={getWeek:(ws)=>{calls.push(ws);return {start:ws,today:'2026-11-03',days:[0,1,2,3,4,5,6].map(i=>({date:ws,lessons:[]}))}}};
const dom=new JSDOM(html,{runScripts:'dangerously',beforeParse(w){
 const mk=()=>{let ok,ko;const r=new Proxy({},{get(_,k){if(k==='withSuccessHandler')return f=>{ok=f;return r};if(k==='withFailureHandler')return f=>{ko=f;return r};return(...a)=>setTimeout(()=>{try{ok(api[k](...a))}catch(e){ko(e)}},0)}});return r;};
 w.google={script:{get run(){return mk()}}}; w.onerror=m=>console.log('ERR',m);
}});
const w=dom.window,d=w.document;const tick=()=>new Promise(r=>setTimeout(r,30));
const swipe=(dx)=>{const m=d.getElementById('main');const s=new w.Event('touchstart',{bubbles:true});s.touches=[{clientX:300,clientY:200}];m.dispatchEvent(s);
 const e=new w.Event('touchend',{bubbles:true});e.changedTouches=[{clientX:300+dx,clientY:205}];m.dispatchEvent(e);};
const title=()=>d.querySelector('h1').textContent;
(async()=>{
 await tick(); await tick(); const t0=title(); console.log('start', t0, 'prefetched:', calls.length);
 const before=calls.length; swipe(120); await tick(); console.log('swipe right ->', title(), '| instant (no new load for shown week):', !d.querySelector('.center'));
 swipe(-120); await tick(); swipe(-120); await tick(); console.log('two swipes left ->', title());
 swipe(20); await tick(); console.log('tiny move ignored:', title());
 await new Promise(r=>setTimeout(r,450)); d.querySelector('[data-act="weekToday"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await tick(); await tick();
 console.log('today button (after swipe guard):', title()===t0 ? 'back to this week' : title());
})();
