const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const NOW=Date.parse('2026-11-19T10:00:00+08:00'),DAY=86400000;
function app(){
 let now=NOW;
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const values=new Map();
 const c=vm.createContext({console,Date:Clock,Event:class{},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},
  localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},
  document:{getElementById:()=>({}),addEventListener(){}},addEventListener(){},dispatchEvent(){}});
 c.window=c;
 for(const file of ['mastery-core.js','new-learned-core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const code=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const APP_VERSION'));
 vm.runInContext(code.replace(/\ninit\(\);/,'\n'),c);
 vm.runInContext(`questions=[{id:'q1',chapter:'A',type:'flash'},{id:'q2',chapter:'B',type:'flash'}];
 practice={mode:'review',queue:['q1'],pos:0,feedback:'',revealed:true};
 renderPractice=()=>{};toast=()=>{};`,c);
 return {run:s=>vm.runInContext(s,c),json:s=>JSON.parse(vm.runInContext('JSON.stringify('+s+')',c)),time:t=>now=t,values};
}
function mature(a,{stage=4,daysAgo=30}={}){
 a.run(`state.memory.q1={phase:'review',cycleStart:Date.now()-${daysAgo}*86400000,stage:${stage},dueTs:Date.now()-1000,todayPasses:2,lapses:0,evidenceComplete:true,reviewPasses:[{day:14,ts:Date.now()-86400000,cycleStart:Date.now()-${daysAgo}*86400000}]}`);
}
function grade(a,r){a.run(`recordAnswer(questions[0],'自评',${r==='good'},'${r}')`);}


test('one successful answer learns a new item and same-day repeats do not advance',()=>{
 const a=app();grade(a,'good');assert.equal(a.run('state.memory.q1.stage'),0);
 assert.equal(a.run('state.memory.q1.phase'),'review');
 grade(a,'good');assert.equal(a.run('state.memory.q1.stage'),0);
 a.time(NOW+DAY);grade(a,'good');assert.equal(a.run('state.memory.q1.stage'),2);
 assert.equal(a.run('state.memory.q1.dueTs'),a.run('QuizMastery.dueAt(Date.now(),6)'));
});
test('overdue success moves exactly one stage from actual answer date',()=>{
 const a=app();mature(a,{stage:2,daysAgo:60});grade(a,'good');
 assert.equal(a.run('state.memory.q1.stage'),4);
 assert.equal(a.run('state.memory.q1.dueTs'),a.run('QuizMastery.dueAt(Date.now(),23)'));
});
test('early practice advances but never twice on the same day',()=>{
 const a=app();mature(a);a.run('state.memory.q1.dueTs=Date.now()+30*86400000');grade(a,'good');
 assert.equal(a.run('state.memory.q1.stage'),5);grade(a,'good');assert.equal(a.run('state.memory.q1.stage'),5);
});
test('failure schedules tomorrow and old delayed records survive until answering',()=>{
 const a=app();mature(a);const before=a.json('state.memory');a.run('migrateMemory()');assert.deepEqual(a.json('state.memory'),before);
 grade(a,'again');assert.equal(a.run('state.memory.q1.recheckDueTs'),a.run('QuizMastery.dueAt(Date.now(),1)'));
 a.time(NOW+DAY);grade(a,'good');assert.equal(a.run('state.memory.q1.phase'),'review');
});

test('legacy stages preserve their due dates and join the next active node',()=>{
 for(const [stage,next,days] of [[1,2,6],[3,4,23],[4,5,30],[5,6,60]]){
  const a=app();mature(a,{stage});const old=a.run('state.memory.q1.dueTs');
  a.run('migrateMemory()');assert.equal(a.run('state.memory.q1.dueTs'),old);
  grade(a,'good');assert.equal(a.run('state.memory.q1.stage'),next);
  assert.equal(a.run('state.memory.q1.dueTs'),a.run('QuizMastery.dueAt(Date.now(),'+days+')'));
 }
});
