const fs=require('fs'),vm=require('vm');
const TZ='Asia/Jerusalem';
function parts(d){const f=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);const o={};f.forEach(p=>o[p.type]=p.value);return o;}
const Utilities={
 formatDate(d,tz,p){const o=parts(d);return p.replace('yyyy',o.year).replace('MM',o.month).replace('dd',o.day).replace('HH',o.hour).replace('mm',o.minute);},
 parseDate(s,tz,p){const m=s.match(/(\d+)-(\d+)-(\d+)(?: (\d+):(\d+))?/);const utc=Date.UTC(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0));let g=new Date(utc);for(let i=0;i<2;i++){const o=parts(g);const asUtc=Date.UTC(+o.year,+o.month-1,+o.day,+o.hour,+o.minute);g=new Date(g.getTime()+(utc-asUtc));}return g;},
 getUuid(){return Math.random().toString(16).slice(2)+'abcdef1234567890';},
 newBlob(b,m,n){return {b,m,n};}, base64Decode(s){return Buffer.from(s,'base64');}
};
class Sheet{constructor(n){this.n=n;this.d=[];}setName(n){this.n=n}getMaxRows(){return 1000}getLastRow(){return this.d.length}
 getRange(r,c,nr,nc){const sh=this;nr=nr||1;nc=nc||1;return{setNumberFormat(){return this},setFontWeight(){return this},
  setValues(v){for(let i=0;i<nr;i++){sh.d[r-1+i]=sh.d[r-1+i]||[];for(let j=0;j<nc;j++)sh.d[r-1+i][c-1+j]=v[i][j];}return this},
  getValues(){const o=[];for(let i=0;i<nr;i++){o.push([]);for(let j=0;j<nc;j++)o[i].push(((sh.d[r-1+i]||[])[c-1+j])??'')}return o}}}
 setFrozenRows(){}setRightToLeft(){}getLastColumn(){return Math.max(0,...this.d.map(r=>(r||[]).length))}}
const SS={sheets:[new Sheet('Sheet1')],getSheets(){return this.sheets},insertSheet(n){const s=new Sheet(n);this.sheets.push(s);return s},getSheetByName(n){return this.sheets.find(s=>s.n===n)},getUrl(){return 'url'},getId(){return 'ss1'}};
const SpreadsheetApp={create(){return SS},openById(){return SS}};
const store={};const PropertiesService={getScriptProperties(){return{getProperty:k=>store[k]??null,setProperty:(k,v)=>{store[k]=v},deleteAllProperties(){for(const k in store)delete store[k]}}}};
const LockService={getScriptLock(){return{waitLock(){},releaseLock(){}}}};
function mkCal(id,name){return{id,name,ev:[],getId(){return id},getName(){return name},
 getEvents(f,t,o){return this.ev.filter(e=>e.s<t&&e.e>f&&(!o||!o.search||e.title.includes(o.search))).map(e=>({getId:()=>e.id,getTitle:()=>e.title,getStartTime:()=>e.s,getEndTime:()=>e.e,isAllDayEvent:()=>!!e.allDay,isRecurringEvent:()=>!!e.rec}))},
 createEvent(title,s,e){const ev={id:'new'+this.ev.length,title,s,e};this.ev.push(ev);return ev;}};}
const main=mkCal('main@cal','lessons'), studio=mkCal('studio@cal','studio');
const CalendarApp={Color:{PURPLE:'p'},getCalendarById:id=>[main,studio].find(c=>c.id===id)||null,getOwnedCalendarsByName:()=>[],createCalendar:()=>main,getAllCalendars:()=>[main,studio]};
const files={};const mkFolder=(id)=>({getId:()=>id,getUrl:()=>'f',getFoldersByName:()=>({hasNext:()=>false}),createFolder:n=>mkFolder(n),createFile:(b)=>{const fid='file'+Object.keys(files).length;files[fid]={trashed:false};return{getId:()=>fid,getUrl:()=>'u/'+fid,getSize:()=>b.b.length}}});
const DriveApp={createFolder:()=>mkFolder('root'),getFolderById:()=>mkFolder('root'),getFileById:id=>({setTrashed:v=>{files[id].trashed=v}})};
const ctx={Utilities,SpreadsheetApp,PropertiesService,LockService,CalendarApp,DriveApp,Logger:{log:()=>{}},HtmlService:{},console};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),ctx);
const at=(d,t)=>Utilities.parseDate(d+' '+t,TZ,'yyyy-MM-dd HH:mm');
const ok=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok',m)};
ctx.setup();
// studio calendar (read-only) + own calendar
store.EXTRA_CAL_IDS='studio@cal';
studio.ev.push({id:'a',title:'נועה',s:at('2026-11-03','16:00'),e:at('2026-11-03','17:00')});
studio.ev.push({id:'b',title:' איתי ',s:at('2026-10-27','17:00'),e:at('2026-10-27','18:00')});
main.ev.push({id:'c',title:'שירה',s:at('2026-11-04','15:30'),e:at('2026-11-04','16:30')});
main.ev.push({id:'d',title:'נועה',s:at('2026-11-03','16:00'),e:at('2026-11-03','17:00')}); // duplicate of studio lesson
main.ev.push({id:'r',title:'תמר',rec:true,s:at('2026-11-05','17:00'),e:at('2026-11-05','18:00')});
main.ev.push({id:'all',title:'חג',allDay:true,s:at('2026-11-02','00:00'),e:at('2026-11-03','00:00')});
let w=ctx.getWeek('2026-11-01');
const flat=w.days.flatMap(d=>d.lessons);
ok(w.days.length===7 && w.days[0].date==='2026-11-01' && w.days[6].date==='2026-11-07','7 days with right dates');
ok(flat.length===3,'3 lessons in week (duplicate merged, all-day skipped): '+flat.map(l=>l.name+l.date+l.time).join(','));
ok(w.days[2].lessons[0].name==='נועה' && w.days[2].lessons[0].time==='16:00','studio lesson on Tuesday 16:00');
const tamar=flat.find(l=>l.name==='תמר'); ok(tamar.key==='r|2026-11-05','recurring key includes date');
// save summary + songs, upload, hide song
const noa=w.days[2].lessons[0];
const L=ctx.getLesson({key:noa.key,studentId:noa.studentId,date:noa.date,time:noa.time});
ok(L.name==='נועה' && L.summary==='','getLesson empty');
ctx.saveLesson({key:noa.key,studentId:noa.studentId,date:noa.date,time:noa.time,summary:'סיכום א',songs:['Valerie',' Valerie ','Jolene']});
w=ctx.getWeek('2026-11-01'); const noa2=w.days[2].lessons.find(l=>l.name==='נועה');
ok(noa2.status==='done' && noa2.summary==='סיכום א','summary saved, still one Noa lesson: '+w.days[2].lessons.length);
let fl=ctx.uploadFile({key:noa.key,studentId:noa.studentId,date:noa.date,time:noa.time},'a.pdf','application/pdf',Buffer.from('hi').toString('base64'));
ok(fl.length===1,'file attached');
const studs=ctx.getStudents(); ok(studs.length===4,'students auto-created incl. trimmed name: '+studs.map(s=>s.name).join(','));
const itai=studs.find(s=>s.name==='איתי'); ok(itai && itai.missing===1 && itai.last==='2026-10-27','past lesson without summary counts as missing');
const st=ctx.getStudent(noa.studentId); ok(st.history.length===1 && st.songs.length===2,'student history + 2 songs');
ok(st.history[0].files.length===1,'file shows in history');
ctx.hideSong(noa.studentId,'Jolene'); ok(ctx.getStudent(noa.studentId).songs.map(s=>s.name).join()==='Valerie','song hidden from list');
ok(ctx.getStudent(noa.studentId).history[0].songs.includes('Jolene'),'lesson itself keeps the song');
ctx.saveLesson({key:noa.key,studentId:noa.studentId,date:noa.date,time:noa.time,summary:'סיכום ב',songs:['Valerie','Jolene']});
ok(ctx.getStudent(noa.studentId).songs.length===2,'using song again brings it back');
fl=ctx.removeFile({key:noa.key,studentId:noa.studentId,date:noa.date,time:noa.time},'file0'); ok(fl.length===0 && files.file0.trashed,'file removed + trashed');
const r=ctx.addLesson({name:'יואב',date:'2026-11-06',time:'11:00',minutes:45});
ok(main.ev.some(e=>e.title==='יואב') && !studio.ev.some(e=>e.title==='יואב'),'manual lesson goes to own calendar only');
w=ctx.getWeek('2026-11-01'); ok(w.days[5].lessons.some(l=>l.name==='יואב' && l.time==='11:00'),'manual lesson shows Friday 11:00');
// DST week (Israel clocks change 2026-10-25)
w=ctx.getWeek('2026-10-25'); ok(w.days.map(d=>d.date).join()==='2026-10-25,2026-10-26,2026-10-27,2026-10-28,2026-10-29,2026-10-30,2026-10-31','dates correct across clock change');
ok(w.days[2].lessons.some(l=>l.name==='איתי'),'Itai in DST week');
// stored values remain strings
ok(SS.getSheetByName('שיעורים').d.slice(1).every(row=>typeof row[2]==='string'),'dates stored as text');
