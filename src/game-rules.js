export const ATTACK_MOVES = [
 {id:'hyper',name:'破壞光線',diff:'champion',label:'難',damage:150},
 {id:'thunder',name:'打雷',diff:'hard',label:'中偏難',damage:110},
 {id:'thunderbolt',name:'十萬伏特',diff:'medium',label:'中',damage:90},
 {id:'shockwave',name:'電擊波',diff:'basic',label:'中偏易',damage:60},
 {id:'shock',name:'電擊',diff:'easy',label:'易',damage:40},
];
export function readProgress(storage){
 const blank={version:1,partnerId:25,capturedIds:[25],attempts:{},wins:0};
 try{const p=JSON.parse(storage.getItem('pokechinese.progress.v1'));if(!p||p.version!==1||!Array.isArray(p.capturedIds)||!p.attempts||typeof p.attempts!=='object'||Array.isArray(p.attempts))return blank;const attempts=Object.fromEntries(Object.entries(p.attempts).filter(([k,a])=>typeof k==='string'&&a&&Number.isInteger(a.total)&&a.total>0&&Number.isInteger(a.correct)&&a.correct>=0&&a.correct<=a.total&&typeof a.lastCorrect==='boolean'));return {...blank,partnerId:Number.isInteger(p.partnerId)?p.partnerId:25,capturedIds:[...new Set([25,...p.capturedIds.filter(Number.isInteger)])],attempts,wins:Number.isInteger(p.wins)&&p.wins>=0?p.wins:0};}catch{return blank;}
}
export function updateAttempt(progress,id,correct){if(!id)return progress;const old=progress.attempts[id]||{total:0,correct:0};return {...progress,attempts:{...progress.attempts,[id]:{total:old.total+1,correct:old.correct+(correct?1:0),lastCorrect:correct}}};}
