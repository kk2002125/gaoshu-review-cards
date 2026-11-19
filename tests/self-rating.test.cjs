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

test('new partial ratings schedule 1 / 3 day checks without passing initial learning',()=>{
 for(const [r,days] of [['hazy',1],['careless',3]]){
  const a=app();grade(a,r);
  assert.equal(a.run('state.memory.q1.phase'),'learning');
  assert.equal(a.run('state.memory.q1.todayPasses'),0);
  assert.equal(a.run('state.memory.q1.recheckDueTs'),a.run(`QuizMastery.dueAt(Date.now(),${days})`));
  assert.equal(a.run('state.stats.correct'),0);
  assert.equal(a.run('state.backupProgressCount'),1);
  assert.equal(a.run('state.history[0].rating'),r);
  assert.deepEqual(a.json('learningIds()'),[]);
  assert.deepEqual(a.json('newQuestionIdsInOrder()'),['q2']);
  assert.ok(a.json('state.wrongIds').includes('q1'));
 }
});
test('mature partial ratings preserve checkpoints and use 3 / 7 day validation',()=>{
 for(const [r,days] of [['hazy',3],['careless',7]]){
  const a=app();mature(a);const old=a.json('state.memory.q1');grade(a,r);
  const m=a.json('state.memory.q1');
  for(const k of ['phase','cycleStart','stage','reviewPasses','lapses'])assert.deepEqual(m[k],old[k]);
  assert.equal(m.recheckDueTs,a.run(`QuizMastery.dueAt(Date.now(),${days})`));
  assert.equal(a.run('QuizMastery.describe(state.memory.q1).passedDay'),14);
  assert.deepEqual(a.json('dueReviewIds()'),[]);
 }
});
test('upcoming formal checkpoint and existing check are never pushed later',()=>{
 const a=app();mature(a);a.run('state.memory.q1.dueTs=QuizMastery.dueAt(Date.now(),1)');grade(a,'careless');
 assert.equal(a.run('state.memory.q1.recheckDueTs'),a.run('state.memory.q1.dueTs'));
 const b=app();grade(b,'hazy');const due=b.run('state.memory.q1.recheckDueTs');grade(b,'careless');
 assert.equal(b.run('state.memory.q1.recheckDueTs'),due);
});
test('repeated careless failures shorten to next day',()=>{
 const a=app();mature(a);grade(a,'careless');a.time(NOW+7*DAY);grade(a,'careless');
 assert.equal(a.run('state.memory.q1.recheckDueTs'),a.run('QuizMastery.dueAt(Date.now(),1)'));
});
test('partial validation enters forecasts, including learning and mastered items',()=>{
 for(const phase of ['learning','mastered']){
  const a=app();a.run(`state.memory.q1={phase:'${phase}',stage:7,reviewPasses:[]}`);grade(a,'hazy');
  assert.deepEqual(a.json('QuizMastery.forecast(questions,state.memory).tomorrowIds'),['q1']);
  a.time(NOW+DAY);
  assert.deepEqual(a.json('dueReviewIds()'),['q1']);
  assert.deepEqual(a.json('QuizMastery.forecast(questions,state.memory).dueIds'),['q1']);
 }
});
test('success on a due validation advances an overdue formal checkpoint once',()=>{
 const a=app();mature(a);grade(a,'hazy');a.time(NOW+3*DAY);grade(a,'good');
 assert.equal(a.run('state.memory.q1.stage'),5);
 assert.equal(a.run('state.memory.q1.reviewPasses.length'),2);
 assert.equal(a.run('state.memory.q1.reviewPasses[1].day'),30);
 assert.equal(a.run('QuizMastery.hasRecheck(state.memory.q1)'),false);
 assert.deepEqual(a.json('state.wrongIds'),[]);
});
test('success on early validation does not advance a future checkpoint',()=>{
 const a=app();mature(a);a.run('state.memory.q1.dueTs=QuizMastery.dueAt(Date.now(),15)');grade(a,'hazy');
 a.time(NOW+3*DAY);grade(a,'good');assert.equal(a.run('state.memory.q1.stage'),4);
 assert.equal(a.run('state.memory.q1.reviewPasses.length'),1);
 assert.equal(a.run('QuizMastery.hasRecheck(state.memory.q1)'),false);
});
test('practice before validation date cannot clear it or advance the overdue original checkpoint',()=>{
 const a=app();mature(a);grade(a,'hazy');const due=a.run('state.memory.q1.recheckDueTs');grade(a,'good');
 assert.equal(a.run('state.memory.q1.recheckDueTs'),due);assert.equal(a.run('state.memory.q1.stage'),4);
});
test('new partial item must still earn two correct initial attempts after returning',()=>{
 const a=app();grade(a,'hazy');a.time(NOW+DAY);grade(a,'good');
 assert.equal(a.run('state.memory.q1.phase'),'learning');assert.equal(a.run('state.memory.q1.todayPasses'),1);
 grade(a,'good');assert.equal(a.run('state.memory.q1.phase'),'review');assert.equal(a.run('state.memory.q1.stage'),0);
});
test('cannot solve resets the cycle and clears pending validation',()=>{
 const a=app();mature(a);grade(a,'careless');grade(a,'again');
 assert.equal(a.run('state.memory.q1.phase'),'learning');assert.equal(a.run('state.memory.q1.cycleStart'),null);
 assert.deepEqual(a.json('state.memory.q1.reviewPasses'),[]);assert.equal(a.run('QuizMastery.hasRecheck(state.memory.q1)'),false);
});
test('120-day success still completes the cycle after a partial rating',()=>{
 const a=app();mature(a,{stage:6,daysAgo:120});grade(a,'careless');a.time(NOW+7*DAY);grade(a,'good');
 assert.equal(a.run('state.memory.q1.phase'),'mastered');assert.equal(a.run('state.memory.q1.reviewPasses.at(-1).day'),120);
 assert.equal(a.run('QuizMastery.nextDue(state.memory.q1)'),null);
});
test('chapter extra practice continues preserving existing records',()=>{
 const a=app();mature(a);a.run("practice.mode='chapter'");const before=a.json('state');grade(a,'careless');
 assert.deepEqual(a.json('state'),before);assert.match(a.run('practice.feedback'),/额外练习/);
});
test('guard rejects duplicate clicks and saves new fields in existing backup payload',()=>{
 const a=app();a.run("selfGrade('hazy');selfGrade('careless')");
 assert.equal(a.run('state.stats.total'),1);assert.equal(a.run('state.backupProgressCount'),1);
 const backup=a.json('backupPayload()');
 assert.equal(backup.state.memory.q1.recheckRating,'hazy');
 assert.equal(backup.state.history[0].rating,'hazy');
 a.run(`state={...defaultState(),...JSON.parse(${JSON.stringify(JSON.stringify(backup))}).state}`);
 assert.equal(a.run('state.memory.q1.recheckRating'),'hazy');
});
test('partial choice removes an already queued same-session retry',()=>{
 const a=app();grade(a,'again');assert.equal(a.run('practice.queue.length'),2);grade(a,'hazy');
 assert.equal(a.run('practice.queue.length'),1);
});
test('existing records are not changed merely by loading and migrating the updated app',()=>{
 const a=app();mature(a);const before=a.json('state.memory');a.run('migrateMemory()');
 assert.deepEqual(a.json('state.memory'),before);
});
test('legacy evidence is captured before a partial answer and preview matches its actual date',()=>{
 const a=app();
 a.run(`const start=Date.now()-15*86400000;
 state.memory.q1={phase:'review',cycleStart:start,stage:4,dueTs:QuizMastery.dueAt(start,30)};
 state.history=[{id:'q1',correct:true,ts:start},...[1,3,7,14].map(day=>({id:'q1',correct:true,ts:QuizMastery.dueAt(start,day)}))];`);
 const preview=a.run('selfRatingButtons(questions[0])');
 grade(a,'hazy');
 assert.equal(a.run('state.memory.q1.reviewPasses.length'),4);
 assert.equal(a.run('state.memory.q1.recheckDueTs'),a.run('QuizMastery.dueAt(Date.now(),3)'));
 assert.ok(preview.includes(a.run('formatDay(state.memory.q1.recheckDueTs)')+'再测'));
});
