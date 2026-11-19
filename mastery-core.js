(function(root){
'use strict';
const PREVIOUS_DAYS=[1,3,7,14,30,60];
const DAYS=[...PREVIOUS_DAYS,120],LABELS={unlearned:'未学习',weak:'不熟',hazy:'模糊',familiar:'熟悉'};
const DAY_MS=86400000,CHINA_OFFSET=8*3600000;
function startOfDay(ts){return Math.floor((ts+CHINA_OFFSET)/DAY_MS)*DAY_MS-CHINA_OFFSET;}
function dueAt(start,days){return startOfDay(start)+days*DAY_MS;}
const RATINGS={
 again:{label:'不会',hint:'无思路或方法错误'},
 hazy:{label:'模糊',hint:'关键步骤需要提示'},
 careless:{label:'粗心失误',hint:'思路正确，计算或审题失误'},
 good:{label:'独立做对',hint:'无提示完成，方法和答案正确'}
};
function hasRecheck(m){return Number.isFinite(m?.recheckDueTs)&&m.recheckDueTs>0;}
function nextDue(m){return hasRecheck(m)?m.recheckDueTs:m?.phase==='review'&&Number.isFinite(m.dueTs)&&m.dueTs>0?m.dueTs:null;}
function recheckPlan(m,rating,now=Date.now()){
 if(!['hazy','careless'].includes(rating))throw new Error('Invalid recheck rating');
 const mature=validPasses(m).some(p=>p.day>=14);
 // Repeated slips need a closer check, not another long postponement.
 const repeated=rating==='careless'&&m.lastRating==='careless';
 const days=rating==='hazy'?(mature?3:1):(repeated?1:mature?7:3);
 let dueTs=dueAt(now,days);
 // A failed due attempt is rescheduled; an upcoming checkpoint stays earlier.
 for(const ts of [m.phase==='review'?m.dueTs:null,m.recheckDueTs]){
  if(Number.isFinite(ts)&&ts>now)dueTs=Math.min(dueTs,ts);
 }
 return {dueTs,days};
}
function validPasses(m){return (m.reviewPasses||[]).filter(p=>p&&DAYS.includes(p.day)&&Number.isFinite(p.ts)&&p.ts>=dueAt(m.cycleStart,p.day)&&p.cycleStart===m.cycleStart);}
// Old scheduling can skip overdue checkpoints; stage alone is never pass evidence.
function evidence(m,history=[],id){
 if(!m||m.phase==='learning')return {passes:[],known:true,source:'current'};
 if(Array.isArray(m.reviewPasses))return {passes:validPasses(m),known:m.evidenceComplete!==false,source:'recorded'};
 if(m.phase==='review'&&m.stage===0)return {passes:[],known:true,source:'initial'};
 if(!Number.isFinite(m.cycleStart)||!['review','mastered'].includes(m.phase))return {passes:[],known:false,source:'legacy'};
 const events=history.filter(h=>String(h.id)===String(id)&&Number.isFinite(h.ts)).sort((a,b)=>a.ts-b.ts);
 const anchor=events.filter(h=>h.correct===true&&h.ts<=m.cycleStart&&m.cycleStart-h.ts<=1000).at(-1);
 if(!anchor)return {passes:[],known:false,source:'legacy'};
 // Only the previous schedule needs reconstruction; current cycles save their checkpoints directly.
 let stage=0,phase='review';const passes=[];
 for(const h of events){
  if(h.ts<=m.cycleStart)continue;
  if(h.correct!==true)return {passes:[],known:false,source:'legacy'};
  if(phase==='mastered'||h.ts<dueAt(m.cycleStart,PREVIOUS_DAYS[stage]))continue;
  passes.push({day:PREVIOUS_DAYS[stage],ts:h.ts,cycleStart:m.cycleStart});stage++;
  while(stage<PREVIOUS_DAYS.length&&dueAt(m.cycleStart,PREVIOUS_DAYS[stage])<=h.ts)stage++;
  if(stage>=PREVIOUS_DAYS.length)phase='mastered';
 }
 if(phase!==m.phase||stage!==m.stage)return {passes:[],known:false,source:'legacy'};
 return {passes,known:true,source:'history'};
}
function describe(m,history=[],id,now=Date.now()){
 if(!m)return {key:'unlearned',label:LABELS.unlearned,passedDay:0,days:[],known:true,due:false,overdue:false,nextDay:null,dueTs:null};
 const e=evidence(m,history,id),days=[...new Set(e.passes.map(p=>p.day))].sort((a,b)=>a-b),passedDay=m.phase==='learning'?0:Math.max(0,...days);
 const key=passedDay>=14?'familiar':passedDay>=3?'hazy':'weak',dueTs=nextDue(m),recheck=hasRecheck(m);
 return {key,label:LABELS[key],passedDay,days,known:e.known,source:e.source,due:!!(dueTs&&dueTs<=now),overdue:!!(dueTs&&dueTs<startOfDay(now)),nextDay:!recheck&&m.phase==='review'&&Number.isInteger(m.stage)?DAYS[m.stage]??null:null,dueTs,phase:m.phase,recheck,lastRating:m.lastRating||null};
}
function summarize(questions,memory={},history=[],now=Date.now()){
 const counts={unlearned:0,weak:0,hazy:0,familiar:0,due:0,unknown:0};
 for(const q of questions){const d=describe(memory?.[q.id],history,q.id,now);counts[d.key]++;if(d.due)counts.due++;if(!d.known)counts.unknown++;}
 const entered=questions.length-counts.unlearned;const percentages={};for(const key of ['weak','hazy','familiar'])percentages[key]=entered?Math.round(counts[key]/entered*100):0;
 return {counts,entered,total:questions.length,percentages};
}
function forecast(questions,memory={},now=Date.now()){
 const tomorrow=startOfDay(now)+DAY_MS,end=tomorrow+DAY_MS,seen=new Set(),tomorrowIds=[],dueIds=[];
 for(const q of questions){const id=String(q.id);if(seen.has(id))continue;seen.add(id);const m=memory?.[q.id],dueTs=nextDue(m);if(!dueTs)continue;
 if(dueTs<=now)dueIds.push(q.id);if(dueTs>=tomorrow&&dueTs<end)tomorrowIds.push(q.id);}
 return {tomorrowIds,dueIds,tomorrowCount:tomorrowIds.length,dueCount:dueIds.length,tomorrowStart:tomorrow,tomorrowEnd:end};
}
const api={forecast,DAYS,LABELS,RATINGS,hasRecheck,nextDue,recheckPlan,evidence,describe,summarize,dueAt};root.QuizMastery=api;
})(typeof window==='undefined'?globalThis:window);
