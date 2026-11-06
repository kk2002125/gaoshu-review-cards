(function(root){
'use strict';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const valid=t=>Number.isFinite(t)&&t>0;
function dayKey(ts=Date.now()){return new Date(ts+8*3600000).toISOString().slice(0,10);}
// null means previously learned, but its first-answer date cannot be proved.
function migrate(state){
 const before=JSON.stringify(state.firstAnswers);
 const map=state.firstAnswers&&typeof state.firstAnswers==='object'&&!Array.isArray(state.firstAnswers)?state.firstAnswers:{};
 for(const id of Object.keys(map))if(!valid(map[id]))map[id]=null;
 const history=Array.isArray(state.history)?state.history:[];
 const complete=Number.isInteger(state.stats?.total)&&state.stats.total===history.length&&history.every(h=>h&&h.id!=null&&valid(h.ts));
 const earliest={};for(const h of history)if(h&&h.id!=null&&valid(h.ts))earliest[h.id]=Math.min(earliest[h.id]??Infinity,h.ts);
 const ids=new Set([...Object.keys(state.answers||{}),...Object.keys(state.memory||{}),...(state.wrongIds||[]),...(state.masteredIds||[]),...Object.keys(earliest)]);
 for(const id of ids){
  if(own(map,id))continue;
  const explicit=state.answers?.[id]?.firstAnsweredAt;
  map[id]=valid(explicit)?explicit:complete&&valid(earliest[id])?earliest[id]:null;
 }
 state.firstAnswers=map;return before!==JSON.stringify(map);
}
function record(state,id,now=Date.now()){
 if(!valid(now))return;
 if(!state.firstAnswers)migrate(state);
 if(!own(state.firstAnswers,id))state.firstAnswers[id]=now;
}
function summary(state,now=Date.now()){
 const day=dayKey(now);let count=0,unknown=0;
 for(const time of Object.values(state.firstAnswers||{})){if(valid(time)){if(dayKey(time)===day)count++;}else unknown++;}
 return {count,unknown,day};
}
root.QuizNewLearned={dayKey,migrate,record,summary};
})(typeof window!=='undefined'?window:globalThis);
