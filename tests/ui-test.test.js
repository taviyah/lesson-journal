const {JSDOM}=require('jsdom');const fs=require('fs');
const path=require('path');const INDEX=process.argv[2]||path.join(__dirname,'..','deploy','Index.html');
const html=fs.readFileSync(INDEX,'utf8').replace(/<link[^>]*fonts[^>]*>/,'');
const lesson={key:'e1',studentId:'s1',name:'נועה',date:'2026-11-03',time:'16:00',status:'missing',summary:'',songs:[],files:[]};
const api={
 getWeek:(ws)=>({start:ws,today:'2026-11-03',days:[0,1,2,3,4,5,6].map(i=>({date:'2026-11-0'+(i+1),lessons:i==2?[lesson]:[]}))}),
 getLesson:(b)=>({...b,name:'נועה',summary:'',songs:['Valerie'],files:[{id:'f1',name:'a.pdf',url:'http://x'}],prevSongs:['Valerie','Jolene']}),
 saveLesson:()=>({ok:true}),
 getStudents:()=>[{id:'s1',name:'נועה',count:3,last:'2026-11-01',missing:1}],
 getStudent:(id)=>({id,name:'נועה',history:[{...lesson,summary:'שירים: X\nתרגילים: Y',status:'done',songs:['Valerie'],files:[{id:'f1',name:'a.pdf',url:'http://x'}]}],songs:[{name:'Valerie',count:2,last:'2026-11-01'}]}),
 hideSong:()=>({ok:true}),addLesson:(p)=>({ok:true,name:p.name}),addStudent:(n)=>({id:'s2',name:n})
};
const dom=new JSDOM(html,{runScripts:'dangerously',beforeParse(w){
 w.confirm=()=>true;
 const mk=()=>{let ok,ko;const r=new Proxy({},{get(_,k){if(k==='withSuccessHandler')return f=>{ok=f;return r};if(k==='withFailureHandler')return f=>{ko=f;return r};return(...a)=>setTimeout(()=>{try{ok(api[k](...a))}catch(e){ko(e)}},0)}});return r;};
 w.google={script:{get run(){return mk()}}};
 w.onerror=(m)=>{console.log('ERR',m)};
}});
const w=dom.window,d=w.document;const tick=()=>new Promise(r=>setTimeout(r,20));
const click=sel=>{const e=d.querySelector(sel);if(!e)throw new Error('missing '+sel);e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}))};
(async()=>{
 await tick(); console.log('cal:', !!d.querySelector('.chip'), d.querySelector('.chip .name').textContent);
 click('.chip'); await tick(); console.log('lesson:', !!d.getElementById('summary'), d.querySelectorAll('.song').length);
 const ta=d.getElementById('summary'); ta.value='סיכום'; ta.dispatchEvent(new w.Event('input',{bubbles:true}));
 click('[data-act="addPrevSong"]'); await tick(); console.log('songs after add:', d.querySelectorAll('.song.on').length, 'draft kept:', d.getElementById('summary').value);
 click('[data-act="save"]'); await tick(); await tick(); console.log('back to:', !!d.querySelector('.week')||d.querySelector('main').textContent.slice(0,40));
 click('#tabStu'); await tick(); console.log('students:', d.querySelectorAll('.stu').length);
 click('.stu'); await tick(); console.log('student:', d.querySelectorAll('.hcard').length, d.querySelectorAll('.songrow').length);
 click('[data-act="hideSong"]'); await tick(); await tick(); console.log('after hide ok:', !!d.querySelector('.hcard'));
 click('#tabCal'); await tick(); click('[data-act="goAdd"]'); await tick(); click('.pick'); await tick();
 console.log('add btn enabled:', !d.querySelector('[data-act="addLesson"]').disabled);
 click('[data-act="addLesson"]'); await tick(); await tick(); console.log('after add:', !!d.querySelector('.week'));
})();
