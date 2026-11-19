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
vm.createContext(ctx);const load=f=>vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const at=(d,t)=>Utilities.parseDate(d+' '+t,TZ,'yyyy-MM-dd HH:mm');
const ok=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok',m)};

// 1. OLD version: setup + real-looking data
load(process.argv[2]);
ctx.setup();
store.EXTRA_CAL_IDS='studio@cal';
studio.ev.push({id:'a',title:'נועה',s:at('2026-11-03','16:00'),e:at('2026-11-03','17:00')});
studio.ev.push({id:'b',title:'איתי',s:at('2026-11-02','17:00'),e:at('2026-11-02','18:00')});
let w=ctx.getWeek('2026-11-01'); const noa=w.days[2].lessons[0];
const B=l=>({key:l.key,studentId:l.studentId,date:l.date,time:l.time});
ctx.saveLesson({...B(noa),summary:'סיכום ישן',songs:['Valerie']});
ctx.uploadFile(B(noa),'a.pdf','application/pdf',Buffer.from('x').toString('base64'));
const lessonSheet=SS.getSheetByName('שיעורים');
ok(lessonSheet.d[0].length===8,'old version: 8 columns');
const propsBefore=JSON.stringify(store);

// 2. "Update the site": load NEW code into the same Google account
load(process.argv[3]);
ok(JSON.stringify(store)===propsBefore,'settings (calendar, sheet, extra calendar) kept');
let st=ctx.getStudent(noa.studentId);
ok(st.history[0].summary==='סיכום ישן' && st.history[0].songs[0]==='Valerie' && st.history[0].files.length===1,'old summary, song and file still there');
ok(lessonSheet.d[0].length===9 && lessonSheet.d[0][8]==='absent','new column header added automatically');

// 3. Mark Itai absent
w=ctx.getWeek('2026-11-01'); const itai=w.days[1].lessons[0];
ok(itai.status==='missing','Itai starts as missing');
ctx.saveLesson({...B(itai),summary:'',songs:[],absent:true});
w=ctx.getWeek('2026-11-01'); ok(w.days[1].lessons[0].status==='absent','Itai now shows absent');
let studs=ctx.getStudents(); const it=studs.find(s=>s.name==='איתי');
ok(it.missing===0 && it.count===0,'absent lesson not counted as missing or as a lesson');
ok(ctx.getLesson(B(itai)).absent===true,'lesson screen knows it is absent');
// normal save (no absent field) keeps the mark
ctx.saveLesson({...B(itai),summary:'הודיע שהוא חולה',songs:[]});
ok(ctx.getWeek('2026-11-01').days[1].lessons[0].status==='absent','saving a note keeps the absent mark');
// undo
ctx.saveLesson({...B(itai),summary:'',songs:[],absent:false});
ok(ctx.getWeek('2026-11-01').days[1].lessons[0].status==='missing','undo returns to missing');
// Noa unaffected
ok(ctx.getWeek('2026-11-01').days[2].lessons[0].status==='done','other lessons unchanged');
