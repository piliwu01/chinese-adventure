import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ATTACK_MOVES,readProgress,updateAttempt} from '../src/game-rules.js';
import {validateBank,drawQuestion} from '../src/question-bank.js';
const bank=JSON.parse(fs.readFileSync(new URL('../public/chinese-bank.json',import.meta.url)));
assert.equal(bank.questions.length,300);assert.equal(validateBank(bank).ok,true);
assert.deepEqual(ATTACK_MOVES.map(m=>m.damage),[150,110,90,60,40]);
for(const move of ATTACK_MOVES){const pool=bank.questions.filter(q=>q.status==='active'&&q.difficulty===move.diff);assert.ok(pool.length);const decks={};const seen=new Set();for(let i=0;i<pool.length;i++){let q=drawQuestion(bank,move.diff,decks);assert.ok(pool.some(p=>q.questionId.endsWith(':'+p.id)));assert.ok(!seen.has(q.questionId));seen.add(q.questionId);}assert.equal(seen.size,pool.length);}
assert.throws(()=>drawQuestion({...bank,questions:bank.questions.filter(q=>q.difficulty==='easy')},'champion',{}));
let p=readProgress(null);p=updateAttempt(p,'b:q1',true);p=updateAttempt(p,'b:q1',false);assert.deepEqual(p.attempts['b:q1'],{total:2,correct:1,lastCorrect:false});assert.equal(readProgress({getItem:()=>JSON.stringify(p)}).attempts['b:q1'].total,2);assert.deepEqual(readProgress({getItem:()=>'{bad'}).attempts,{});
console.log(JSON.stringify({passed:true,total:300,active:274,review:26,difficultyPools:ATTACK_MOVES.map(m=>({move:m.name,damage:m.damage,questions:bank.questions.filter(q=>q.status==='active'&&q.difficulty===m.diff).length}))},null,2));
