const {JSDOM}=require('jsdom');const fs=require('fs');
const path=require('path');const INDEX=process.argv[2]||path.join(__dirname,'..','deploy','Index.html');
const html=fs.readFileSync(INDEX,'utf8').replace(/<link[^>]*fonts[^>]*>/,'');
let absent=false;const saved=[];
const L=()=>({key:'e1',studentId:'s1',name:'איתי',date:'2026-11-02',time:'17:00',status:absent?'absent':'missing',absent,summary:'',songs:[],files:[]});
const api={
 getWeek:(ws)=>({start:ws,today:'2026-11-03',days:[0,1,2,3,4,5,6].map(i=>({date:ws,lessons:i==1?[L()]:[]}))}),
 getLesson:()=>({...L(),prevSongs:[]}),
 saveLesson:(p)=>{saved.push(p);if(p.absent!==undefined)absent=p.absent;return{ok:true}},
 getStudents:()=>[],getStudent:(id)=>({id,name:'איתי',history:[L()],songs:[]})
};
const dom=new JSDOM(html,{runScripts:'dangerously',beforeParse(w){
 const mk=()=>{let ok,ko;const r=new Proxy({},{get(_,k){if(k==='withSuccessHandler')return f=>{ok=f;return r};if(k==='withFailureHandler')return f=>{ko=f;return r};return(...a)=>setTimeout(()=>{try{ok(api[k](...a))}catch(e){ko(e)}},0)}});return r;};
 w.google={script:{get run(){return mk()}}}; w.onerror=m=>console.log('ERR',m); w.confirm=()=>true;
}});
const w=dom.window,d=w.document;const tick=()=>new Promise(r=>setTimeout(r,30));
const click=s=>{const e=d.querySelector(s);if(!e)throw new Error('missing '+s);e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}))};
(async()=>{
 await tick();await tick();
 console.log('chip shows missing:', d.querySelector('.chip .pill').textContent);
 click('.chip');await tick();
 console.log('absent button shown:', !!d.querySelector('[data-act="markAbsent"]'));
 click('[data-act="markAbsent"]');await tick();await tick();
 console.log('sent absent=true:', saved.at(-1).absent===true, '| back on calendar:', !!d.querySelector('.week'));
 console.log('chip now:', d.querySelector('.chip .pill').textContent, '| struck name:', d.querySelector('.chip').classList.contains('absent'));
 click('.chip');await tick();
 console.log('banner + undo shown:', !!d.querySelector('.absent-note [data-act="unmarkAbsent"]'), '| mark button hidden:', !d.querySelector('[data-act="markAbsent"]'));
 click('[data-act="unmarkAbsent"]');await tick();await tick();
 console.log('sent absent=false:', saved.at(-1).absent===false, '| mark button back:', !!d.querySelector('[data-act="markAbsent"]'));
 absent=true; click('[data-act="openStudent"]');await tick();await tick();
 console.log('history pill:', d.querySelector('.hcard .pill').textContent, '| subtitle:', d.querySelector('h1').nextElementSibling.textContent);
})();
