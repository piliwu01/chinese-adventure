import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BackgroundMusic } from './music';
import QuestionBankPanel from './QuestionBankPanel';
import defaultBank from './default-bank.json';
import { ATTACK_MOVES, readProgress, updateAttempt } from './game-rules';
import { AUTO_BANK_ID, STORAGE_KEY, validateBank, activeQuestions, drawQuestion, readStoredBanks, writeStoredBanks } from './question-bank';
const browserStorage = () => { try { return window.localStorage; } catch { return null; } };
import { 
  Volume2, VolumeX, Sparkles, RefreshCw, Trophy, Shield, 
  Flame, Droplets, Zap, Leaf, Heart, Search, HelpCircle, 
  ChevronRight, Award, Crosshair, CheckCircle2, XCircle, ArrowLeft, Star,
  Clock, AlertTriangle, Music2, Music, X
} from 'lucide-react';

// ==========================================
// 8-Bit Web Audio 合成音效引擎 (無需外部音訊檔)
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, delay = 0) {
    if (!this.enabled) return;
    this.init();
    setTimeout(() => {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    }, delay);
  }

  tick() {
    this.playTone(800, 'square', 0.05);
  }

  urgentTick() {
    this.playTone(950, 'square', 0.08);
  }

  attack() {
    this.playTone(440, 'square', 0.1);
    this.playTone(220, 'sawtooth', 0.15, 60);
  }

  hit() {
    this.playTone(150, 'triangle', 0.2);
    this.playTone(80, 'sine', 0.25, 40);
  }

  critical() {
    this.playTone(523.25, 'square', 0.08);
    this.playTone(659.25, 'square', 0.08, 70);
    this.playTone(783.99, 'square', 0.12, 140);
    this.playTone(1046.50, 'square', 0.2, 210);
  }

  ballThrow() {
    this.playTone(300, 'sine', 0.1);
    this.playTone(600, 'sine', 0.15, 80);
    this.playTone(900, 'sine', 0.2, 160);
  }

  ballShake() {
    this.playTone(400, 'triangle', 0.08);
    this.playTone(350, 'triangle', 0.1, 90);
  }

  catchSuccess() {
    const notes = [523.25, 659.25, 783.99, 1046.50, 987.77, 1046.50];
    const times = [0, 100, 200, 300, 420, 560];
    notes.forEach((n, i) => this.playTone(n, 'square', 0.18, times[i]));
  }

  faint() {
    this.playTone(400, 'sawtooth', 0.15);
    this.playTone(300, 'sawtooth', 0.15, 120);
    this.playTone(200, 'sawtooth', 0.2, 240);
    this.playTone(120, 'sawtooth', 0.3, 360);
  }

  error() {
    this.playTone(220, 'sawtooth', 0.15);
    this.playTone(180, 'sawtooth', 0.25, 100);
  }
}

const sfx = new SoundFX();

// ==========================================
// 預設與熱門寶可夢資料庫 (各世代中英對照與屬性)
// ==========================================
const GENERATIONS = [
  { gen: 1, name: '第一世代 (關都)', range: [1, 151] },
  { gen: 2, name: '第二世代 (城都)', range: [152, 251] },
  { gen: 3, name: '第三世代 (豐緣)', range: [252, 386] },
  { gen: 4, name: '第四世代 (神奧)', range: [387, 493] },
  { gen: 5, name: '第五世代 (合眾)', range: [494, 649] },
  { gen: 6, name: '第六世代 (卡洛斯)', range: [650, 721] },
  { gen: 7, name: '第七世代 (阿羅拉)', range: [722, 809] },
  { gen: 8, name: '第八世代 (伽勒爾)', range: [810, 898] },
  { gen: 9, name: '第九世代 (帕底亞)', range: [899, 1010] },
];

const POPULAR_POKEMON = [
  // Gen 1
  { id: 25, name: 'Pikachu', zhName: '皮卡丘', type: 'electric', gen: 1 },
  { id: 6, name: 'Charizard', zhName: '噴火龍', type: 'fire', gen: 1 },
  { id: 9, name: 'Blastoise', zhName: '水箭龜', type: 'water', gen: 1 },
  { id: 3, name: 'Venusaur', zhName: '妙蛙花', type: 'grass', gen: 1 },
  { id: 94, name: 'Gengar', zhName: '耿鬼', type: 'ghost', gen: 1 },
  { id: 130, name: 'Gyarados', zhName: '暴鯉龍', type: 'water', gen: 1 },
  { id: 131, name: 'Lapras', zhName: '拉普拉斯', type: 'water', gen: 1 },
  { id: 143, name: 'Snorlax', zhName: '卡比獸', type: 'normal', gen: 1 },
  { id: 150, name: 'Mewtwo', zhName: '超夢', type: 'psychic', gen: 1 },
  { id: 151, name: 'Mew', zhName: '夢幻', type: 'psychic', gen: 1 },
  // Gen 2
  { id: 157, name: 'Typhlosion', zhName: '火暴獸', type: 'fire', gen: 2 },
  { id: 160, name: 'Feraligatr', zhName: '大力鱷', type: 'water', gen: 2 },
  { id: 154, name: 'Meganium', zhName: '大竺葵', type: 'grass', gen: 2 },
  { id: 196, name: 'Espeon', zhName: '太陽伊布', type: 'psychic', gen: 2 },
  { id: 197, name: 'Umbreon', zhName: '月亮伊布', type: 'dark', gen: 2 },
  { id: 248, name: 'Tyranitar', zhName: '班基拉斯', type: 'rock', gen: 2 },
  { id: 249, name: 'Lugia', zhName: '洛奇亞', type: 'psychic', gen: 2 },
  { id: 250, name: 'Ho-Oh', zhName: '鳳王', type: 'fire', gen: 2 },
  // Gen 3
  { id: 254, name: 'Sceptile', zhName: '蜥蜴王', type: 'grass', gen: 3 },
  { id: 257, name: 'Blaziken', zhName: '火焰雞', type: 'fire', gen: 3 },
  { id: 260, name: 'Swampert', zhName: '巨沼怪', type: 'water', gen: 3 },
  { id: 282, name: 'Gardevoir', zhName: '沙奈朵', type: 'psychic', gen: 3 },
  { id: 373, name: 'Salamence', zhName: '暴飛龍', type: 'dragon', gen: 3 },
  { id: 376, name: 'Metagross', zhName: '巨金怪', type: 'steel', gen: 3 },
  { id: 384, name: 'Rayquaza', zhName: '烈空坐', type: 'dragon', gen: 3 },
  // Gen 4
  { id: 392, name: 'Infernape', zhName: '烈焰猴', type: 'fire', gen: 4 },
  { id: 395, name: 'Empoleon', zhName: '帝王拿波', type: 'water', gen: 4 },
  { id: 389, name: 'Torterra', zhName: '土台龜', type: 'grass', gen: 4 },
  { id: 448, name: 'Lucario', zhName: '路卡利歐', type: 'fighting', gen: 4 },
  { id: 445, name: 'Garchomp', zhName: '烈咬陸鯊', type: 'dragon', gen: 4 },
  { id: 470, name: 'Leafeon', zhName: '葉伊布', type: 'grass', gen: 4 },
  { id: 471, name: 'Glaceon', zhName: '冰伊布', type: 'ice', gen: 4 },
  { id: 483, name: 'Dialga', zhName: '帝牙盧卡', type: 'steel', gen: 4 },
  { id: 484, name: 'Palkia', zhName: '帕路奇亞', type: 'water', gen: 4 },
  // Gen 5
  { id: 497, name: 'Serperior', zhName: '君主蛇', type: 'grass', gen: 5 },
  { id: 500, name: 'Emboar', zhName: '炎武王', type: 'fire', gen: 5 },
  { id: 503, name: 'Samurott', zhName: '大劍鬼', type: 'water', gen: 5 },
  { id: 571, name: 'Zoroark', zhName: '索羅亞克', type: 'dark', gen: 5 },
  { id: 609, name: 'Chandelure', zhName: '水晶燈火靈', type: 'ghost', gen: 5 },
  { id: 635, name: 'Hydreigon', zhName: '三首惡龍', type: 'dragon', gen: 5 },
  { id: 643, name: 'Reshiram', zhName: '萊希拉姆', type: 'dragon', gen: 5 },
  { id: 644, name: 'Zekrom', zhName: '捷克羅姆', type: 'dragon', gen: 5 },
  // Gen 6
  { id: 658, name: 'Greninja', zhName: '甲賀忍蛙', type: 'water', gen: 6 },
  { id: 655, name: 'Delphox', zhName: '妖火紅狐', type: 'fire', gen: 6 },
  { id: 652, name: 'Chesnaught', zhName: '布里卡隆', type: 'grass', gen: 6 },
  { id: 700, name: 'Sylveon', zhName: '仙子伊布', type: 'fairy', gen: 6 },
  { id: 716, name: 'Xerneas', zhName: '哲爾尼亞斯', type: 'fairy', gen: 6 },
  { id: 717, name: 'Yveltal', zhName: '伊裴爾塔爾', type: 'dark', gen: 6 },
  // Gen 7
  { id: 724, name: 'Decidueye', zhName: '狙射樹梟', type: 'grass', gen: 7 },
  { id: 727, name: 'Incineroar', zhName: '熾焰咆哮虎', type: 'fire', gen: 7 },
  { id: 730, name: 'Primarina', zhName: '西獅海壬', type: 'water', gen: 7 },
  { id: 778, name: 'Mimikyu', zhName: '謎擬Ｑ', type: 'ghost', gen: 7 },
  { id: 785, name: 'Tapu Koko', zhName: '卡璞・鳴鳴', type: 'electric', gen: 7 },
  // Gen 8
  { id: 815, name: 'Cinderace', zhName: '閃焰王牌', type: 'fire', gen: 8 },
  { id: 818, name: 'Inteleon', zhName: '千面避役', type: 'water', gen: 8 },
  { id: 812, name: 'Rillaboom', zhName: '轟擂金剛猩', type: 'grass', gen: 8 },
  { id: 887, name: 'Dragapult', zhName: '多龍巴魯托', type: 'dragon', gen: 8 },
  { id: 888, name: 'Zacian', zhName: '蒼響', type: 'fairy', gen: 8 },
  // Gen 9
  { id: 908, name: 'Meowscarada', zhName: '魔幻假面喵', type: 'grass', gen: 9 },
  { id: 911, name: 'Skeledirge', zhName: '骨紋巨聲鱷', type: 'fire', gen: 9 },
  { id: 914, name: 'Quaquaval', zhName: '狂歡浪舞鴨', type: 'water', gen: 9 },
  { id: 954, name: 'Rabsca', zhName: '蟲滾泥', type: 'bug', gen: 9 },
  { id: 1007, name: 'Koraidon', zhName: '故勒頓', type: 'fighting', gen: 9 },
  { id: 1008, name: 'Miraidon', zhName: '密勒頓', type: 'electric', gen: 9 }
];

const TYPE_COLORS = {
  normal: { bg: 'bg-stone-500', text: 'text-stone-100', border: 'border-stone-600', zh: '一般' },
  fire: { bg: 'bg-orange-600', text: 'text-orange-100', border: 'border-orange-700', zh: '火' },
  water: { bg: 'bg-blue-600', text: 'text-blue-100', border: 'border-blue-700', zh: '水' },
  grass: { bg: 'bg-emerald-600', text: 'text-emerald-100', border: 'border-emerald-700', zh: '草' },
  electric: { bg: 'bg-amber-500', text: 'text-amber-950', border: 'border-amber-600', zh: '電' },
  ice: { bg: 'bg-cyan-500', text: 'text-cyan-950', border: 'border-cyan-600', zh: '冰' },
  fighting: { bg: 'bg-red-700', text: 'text-red-100', border: 'border-red-800', zh: '格鬥' },
  poison: { bg: 'bg-purple-600', text: 'text-purple-100', border: 'border-purple-700', zh: '毒' },
  ground: { bg: 'bg-yellow-700', text: 'text-yellow-100', border: 'border-yellow-800', zh: '地面' },
  flying: { bg: 'bg-indigo-400', text: 'text-indigo-950', border: 'border-indigo-500', zh: '飛行' },
  psychic: { bg: 'bg-pink-600', text: 'text-pink-100', border: 'border-pink-700', zh: '超能力' },
  bug: { bg: 'bg-lime-600', text: 'text-lime-100', border: 'border-lime-700', zh: '蟲' },
  rock: { bg: 'bg-stone-600', text: 'text-stone-100', border: 'border-stone-700', zh: '岩石' },
  ghost: { bg: 'bg-purple-900', text: 'text-purple-100', border: 'border-purple-950', zh: '幽靈' },
  dragon: { bg: 'bg-indigo-700', text: 'text-indigo-100', border: 'border-indigo-800', zh: '龍' },
  dark: { bg: 'bg-zinc-800', text: 'text-zinc-100', border: 'border-zinc-900', zh: '惡' },
  steel: { bg: 'bg-slate-500', text: 'text-slate-100', border: 'border-slate-600', zh: '鋼' },
  fairy: { bg: 'bg-rose-400', text: 'text-rose-950', border: 'border-rose-500', zh: '妖精' }
};

// ==========================================
// 輔助工具：取得 PokéAPI 精靈圖
// ==========================================
const getSpriteUrl = (id, isBack = false) => {
  if (isBack) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/${id}.gif`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;
};

const getStaticSpriteFallback = (id, isBack = false) => {
  if (isBack) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${id}.png`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
};

// ==========================================
// 數學題目生成器
// ==========================================
const generateMathProblem = (difficulty = 'medium', type = 'attack') => {
  let question = '';
  let answer = 0;
  let options = [];

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  if (difficulty === 'easy') {
    // 基礎加減法 (1~30)
    const op = Math.random() > 0.4 ? '+' : '-';
    if (op === '+') {
      const a = rand(3, 30);
      const b = rand(3, 30);
      question = `${a} + ${b}`;
      answer = a + b;
    } else {
      const a = rand(15, 60);
      const b = rand(2, a - 1);
      question = `${a} - ${b}`;
      answer = a - b;
    }
  } else if (difficulty === 'medium') {
    // 乘除法與雙位數運算
    const mode = rand(1, 3);
    if (mode === 1) {
      // 九九乘法表或二位數乘法
      const a = rand(3, 12);
      const b = rand(3, 12);
      question = `${a} × ${b}`;
      answer = a * b;
    } else if (mode === 2) {
      // 整除法
      const b = rand(3, 9);
      const ans = rand(3, 12);
      const a = b * ans;
      question = `${a} ÷ ${b}`;
      answer = ans;
    } else {
      // 兩位數混合運算
      const a = rand(20, 80);
      const b = rand(15, 60);
      question = `${a} + ${b}`;
      answer = a + b;
    }
  } else if (difficulty === 'hard') {
    // 混合四則運算 (先乘除後加減 / 括號)
    const mode = rand(1, 3);
    if (mode === 1) {
      const a = rand(3, 9);
      const b = rand(3, 8);
      const c = rand(5, 30);
      question = `${a} × ${b} + ${c}`;
      answer = (a * b) + c;
    } else if (mode === 2) {
      const a = rand(30, 80);
      const b = rand(2, 6);
      const c = rand(2, 6);
      question = `${a} - ${b} × ${c}`;
      answer = a - (b * c);
    } else {
      const a = rand(4, 12);
      const b = rand(3, 8);
      const c = rand(2, 5);
      question = `(${a} + ${b}) × ${c}`;
      answer = (a + b) * c;
    }
  } else {
    // 大師級 (Champion)：代數方程式或快速連續運算
    const x = rand(3, 20);
    const m = rand(2, 7);
    const c = rand(4, 25);
    const total = m * x + c;
    question = `${m}x + ${c} = ${total}，求 x = ?`;
    answer = x;
  }

  // 產生 4 個不重複的干擾選項
  const optSet = new Set([answer]);
  while (optSet.size < 4) {
    const delta = rand(-12, 12);
    const wrong = answer + delta;
    if (wrong !== answer && wrong >= 0) {
      optSet.add(wrong);
    } else {
      optSet.add(answer + rand(1, 15) * (Math.random() > 0.5 ? 1 : -1));
    }
  }
  options = Array.from(optSet).sort(() => Math.random() - 0.5);

  return { question, answer, options };
};

// ==========================================
// 主應用程式 Component
// ==========================================
export default function App() {
  // 畫面模式: 'select' (挑選寶可夢) | 'battle' (對戰) | 'box' (寶可夢盒)
  const initialProgress = useRef(readProgress(browserStorage()));
  const [progress, setProgress] = useState(initialProgress.current);
  const [saveWarning, setSaveWarning] = useState('');
  const answered = useRef(false);
  const [view, setView] = useState('select');
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [musicPanel, setMusicPanel] = useState(false);
  const [musicReady, setMusicReady] = useState(false);
  const musicRef = useRef(null);
  const [difficulty, setDifficulty] = useState('medium');
  const [questionBanks, setQuestionBanks] = useState(() => [defaultBank, ...readStoredBanks(browserStorage()).filter(b=>b.bankId!==defaultBank.bankId)]);
  const [selectedBankId, setSelectedBankId] = useState(defaultBank.bankId);
  const [bankNotice, setBankNotice] = useState('');
  const [questionFeedback, setQuestionFeedback] = useState(null);
  const questionDecks = useRef({});
  const importing = useRef(false);
  const selectedBank = questionBanks.find(bank => bank.bankId === selectedBankId);
  const changeBank = (id) => { setSelectedBankId(id); setQuestionFeedback(null); questionDecks.current = {}; };
  const importBanks = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (importing.current || !files.length) return;
    importing.current = true;
    try {
      const next = [...questionBanks];
      const messages = [];
      for (const file of files) {
        try {
          if (file.size > 5 * 1024 * 1024) throw new Error('檔案超過 5 MB，請分成較小題庫。');
          const bank = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
          const result = validateBank(bank);
          if (!result.ok) throw new Error(result.errors.slice(0, 3).join('；'));
          if (next.some(b => b.bankId === bank.bankId)) throw new Error('bankId 已存在；更新題庫請使用新的版本 ID，避免覆蓋。');
          next.push(bank);
          messages.push(file.name + '：已匯入 ' + result.active + ' 題可用題目' + (!result.active ? '（全部待確認，尚不可選用）' : ''));
        } catch (error) { messages.push(file.name + '：未匯入，' + error.message); }
      }
      setQuestionBanks(next);
      if (!writeStoredBanks(next, browserStorage())) messages.push('瀏覽器未能保存，新增題庫僅本次有效。');
      setBankNotice(messages.join('。'));
    } finally { importing.current = false; }
  };
  const [activeGen, setActiveGen] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  // 玩家與對手
  const [playerPokemon, setPlayerPokemon] = useState(POPULAR_POKEMON.find(p=>p.id===initialProgress.current.partnerId)||POPULAR_POKEMON[0]); // saved partner
  const [playerHp, setPlayerHp] = useState(100);
  const [playerMaxHp, setPlayerMaxHp] = useState(100);
  const [playerLevel, setPlayerLevel] = useState(25);

  const [enemyPokemon, setEnemyPokemon] = useState(POPULAR_POKEMON[1]); // Charizard
  const [enemyHp, setEnemyHp] = useState(120);
  const [enemyMaxHp, setEnemyMaxHp] = useState(120);
  const [enemyLevel, setEnemyLevel] = useState(24);

  // 捕獲清單 (背包/圖鑑)
  const [capturedList, setCapturedList] = useState(() => POPULAR_POKEMON.filter(p=>initialProgress.current.capturedIds.includes(p.id)));
  useEffect(()=>{
    try { browserStorage().setItem('pokechinese.progress.v1',JSON.stringify({...progress,partnerId:playerPokemon.id,capturedIds:capturedList.map(p=>p.id)})); setSaveWarning(''); }
    catch { setSaveWarning('目前無法保存進度，請下載進度備份。'); }
  },[progress,playerPokemon,capturedList]);
  const recordAttempt=(correct)=>setProgress(p=>updateAttempt(p,currentMath.questionId,correct));
  const exportProgress=()=>{const blob=new Blob([JSON.stringify({...progress,partnerId:playerPokemon.id,capturedIds:capturedList.map(p=>p.id)},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='國文冒險_進度備份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const restoreProgress=async(event)=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;try{if(file.size>2*1024*1024)throw new Error('備份檔過大');const raw=JSON.parse(await file.text());if(raw.version!==1||!Array.isArray(raw.capturedIds)||!raw.attempts||typeof raw.attempts!=='object')throw new Error('不是有效的進度備份');const p=readProgress({getItem:()=>JSON.stringify(raw)});setProgress(p);setPlayerPokemon(POPULAR_POKEMON.find(x=>x.id===p.partnerId)||POPULAR_POKEMON[0]);setCapturedList(POPULAR_POKEMON.filter(x=>p.capturedIds.includes(x.id)));setWinStreak(p.wins);setBankNotice('進度備份已還原。');}catch(error){setBankNotice('無法還原：'+error.message);}};

  // 對戰狀態
  const [battleState, setBattleState] = useState('ready'); // 'ready', 'playerTurn', 'mathPending', 'animating', 'enemyTurn', 'catching', 'won', 'lost', 'caught'
  const [battleLogs, setBattleLogs] = useState([]);
  const [selectedMove, setSelectedMove] = useState(null);
  const [currentMath, setCurrentMath] = useState(null);
  const [mathTimer, setMathTimer] = useState(15);
  const [maxMathTimer, setMaxMathTimer] = useState(15);
  const [winStreak, setWinStreak] = useState(initialProgress.current.wins || 0);
  useEffect(()=>setProgress(p=>({...p,wins:winStreak})),[winStreak]);

  const musicTheme = view !== 'battle' ? 'adventure' : ['won', 'caught'].includes(battleState) ? 'victory' : battleState === 'lost' ? 'rest' : 'battle';
  const musicTitles = { adventure: '輕快出發', battle: '腦力交鋒', victory: '勝利時刻', rest: '再次啟程' };

  useEffect(() => {
    const music = new BackgroundMusic();
    musicRef.current = music;
    const unlock = async () => {
      const ready = await music.unlock();
      setMusicReady(ready);
    };
    const visibility = () => music.configure({ hidden: document.hidden });
    const escape = (event) => { if (event.key === 'Escape') setMusicPanel(false); };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    document.addEventListener('keydown', escape);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('visibilitychange', visibility);
      music.dispose();
      musicRef.current = null;
    };
  }, []);

  useEffect(() => {
    musicRef.current?.configure({ enabled: musicOn, volume: musicVolume, theme: musicTheme, hidden: document.hidden });
  }, [musicOn, musicVolume, musicTheme]);

  // 動畫視覺狀態
  const [playerAnim, setPlayerAnim] = useState(''); // 'shake', 'attack', 'faint'
  const [enemyAnim, setEnemyAnim] = useState('');
  const [catchShakeStep, setCatchShakeStep] = useState(0); // 0, 1, 2, 3, 4 (Success)
  const [damagePopup, setDamagePopup] = useState(null); // { target: 'enemy'|'player', text: string, type: string }

  // 隨機自 PokeAPI 搜尋額外寶可夢 (搜尋自訂 ID / 英文名)
  const [apiLoading, setApiLoading] = useState(false);
  const [customPokemonList, setCustomPokemonList] = useState([]);

  // 計時器倒數邏輯
  useEffect(() => {
    let timerId = null;
    if (battleState === 'mathPending' && mathTimer > 0) {
      timerId = setInterval(() => {
        setMathTimer((prev) => {
          if (prev <= 4 && prev > 1) {
            sfx.urgentTick();
          } else if (prev > 4) {
            sfx.tick();
          }
          return prev - 1;
        });
      }, 1000);
    } else if (battleState === 'mathPending' && mathTimer === 0 && !answered.current) {
      answered.current=true;recordAttempt(false);
      if (currentMath?.optionTexts) setQuestionFeedback({ correct: false, question: currentMath.question, answer: currentMath.optionTexts[currentMath.answer], explanation: currentMath.explanation, sourceRef: currentMath.sourceRef });
      // 時間到！視為答錯落空
      sfx.error();
      addLog(`⏰ 時間到！未能及時選出答案，招式落空！`);
      setBattleState('animating');
      setTimeout(() => {
        executeEnemyTurn();
      }, 1200);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [battleState, mathTimer]);

  // 切換音效開關
  useEffect(() => {
    sfx.enabled = soundOn;
  }, [soundOn]);

  // 加入對戰日誌
  const addLog = (text) => {
    setBattleLogs((prev) => [text, ...prev.slice(0, 7)]);
  };

  // 隨機挑選野生地圖對手
  const spawnEnemy = () => {
    setEnemyAnim('');
    setPlayerAnim('');
    setDamagePopup(null);
    // 隨機選一個非玩家的寶可夢
    const pool = POPULAR_POKEMON.filter((p) => p.id !== playerPokemon.id);
    const enemy = pool[Math.floor(Math.random() * pool.length)] || POPULAR_POKEMON[1];
    const lv = Math.max(5, playerLevel + Math.floor(Math.random() * 5) - 2);
    const maxHp = 80 + lv * 4;

    setEnemyPokemon(enemy);
    setEnemyMaxHp(maxHp);
    setEnemyHp(maxHp);
    setEnemyLevel(lv);
    setBattleState('ready');
    setQuestionFeedback(null);
    setCatchShakeStep(0);
    setBattleLogs([`野生的 ${enemy.zhName || enemy.name} 出現了！`]);
  };

  // 開始對戰
  const startBattle = (chosenPlayer = playerPokemon) => {
    const pMaxHp = 85 + playerLevel * 4;
    setPlayerPokemon(chosenPlayer);
    setPlayerMaxHp(pMaxHp);
    setPlayerHp(pMaxHp);
    setView('battle');
    spawnEnemy();
  };

  // 技能定義
  const moves = useMemo(() => [...ATTACK_MOVES, {id:'catch',name:'丟出精靈球',diff:enemyHp/enemyMaxHp<=.35?'easy':'medium',damage:0,label:enemyHp/enemyMaxHp<=.35?'易':'中',desc:'答對後嘗試收服'}],[enemyHp,enemyMaxHp]);

  // 選擇動作 -> 啟動算術題
  const handleSelectMove = (move) => {
    if (battleState !== 'ready' && battleState !== 'playerTurn') return;
    if(selectedBank && !selectedBank.questions.some(q=>q.status==='active'&&q.difficulty===move.diff)){setBankNotice('此難度沒有可用題目，請選其他招式。');return;}
    answered.current=false;
    sfx.attack();
    setSelectedMove(move);
    setQuestionFeedback(null);
    const mathProblem = selectedBank ? drawQuestion(selectedBank, move.diff, questionDecks.current) : generateMathProblem(move.diff, move.id);
    
    // 設定不同難度的作答時間
    let timeLimit = 12;
    if (move.diff === 'easy') timeLimit = 10;
    else if (move.diff === 'medium') timeLimit = 12;
    else if (move.diff === 'hard') timeLimit = 15;
    else timeLimit = 18;

    if (selectedBank) timeLimit = selectedBank.timeLimitSeconds || 30;
    setMaxMathTimer(timeLimit);
    setMathTimer(timeLimit);
    setCurrentMath(mathProblem);
    setBattleState('mathPending');
  };

  // 提交數學答案
  const handleAnswerSubmit = (selectedOption) => {
    if (!currentMath || battleState !== 'mathPending' || answered.current) return;
    answered.current=true;

    const isCorrect = selectedOption === currentMath.answer;
    recordAttempt(isCorrect);
    if (currentMath.optionTexts) setQuestionFeedback({ correct: isCorrect, question: currentMath.question, answer: currentMath.optionTexts[currentMath.answer], explanation: currentMath.explanation, sourceRef: currentMath.sourceRef });

    if (isCorrect) {
      sfx.critical();
      addLog(`✨ 答對了！${currentMath.optionTexts ? `正確答案：${currentMath.optionTexts[currentMath.answer]}` : `算式 ${currentMath.question} = ${currentMath.answer}`}`);
      if (selectedMove.id === 'catch') {
        executeCatchAttempt();
      } else {
        executePlayerAttack(selectedMove);
      }
    } else {
      sfx.error();
      addLog(`❌ 作答錯誤！正確答案是 ${currentMath.optionTexts ? currentMath.optionTexts[currentMath.answer] : currentMath.answer}。攻擊落空了！`);
      setBattleState('animating');
      setTimeout(() => {
        executeEnemyTurn();
      }, 1200);
    }
  };

  // 玩家執行攻擊
  const executePlayerAttack = (move) => {
    setBattleState('animating');
    setPlayerAnim('translate-x-6 -translate-y-3 scale-105');

    setTimeout(() => {
      setPlayerAnim('');
      setEnemyAnim('animate-bounce brightness-150');

      const baseDmg = move.damage;

      const newEnemyHp = Math.max(0, enemyHp - baseDmg);
      setEnemyHp(newEnemyHp);
      sfx.hit();

      setDamagePopup({ target: 'enemy', text: `-${baseDmg}`, type: 'player' });
      addLog(`💥 ${playerPokemon.zhName || playerPokemon.name} 使用了【${move.name}】！造成 ${baseDmg} 點傷害！`);

      setTimeout(() => {
        setEnemyAnim('');
        setDamagePopup(null);

        if (newEnemyHp <= 0) {
          handleVictory();
        } else {
          executeEnemyTurn();
        }
      }, 1000);
    }, 400);
  };

  // 執行收服邏輯
  const executeCatchAttempt = () => {
    setBattleState('catching');
    sfx.ballThrow();
    addLog(`🔴 丟出了精靈球！去吧！`);

    // 計算收服機率：殘血 (<35%) 90% 機率，普通血量 30% 機率
    const hpRatio = enemyHp / enemyMaxHp;
    const isLowHp = hpRatio <= 0.35;
    const catchChance = isLowHp ? 0.92 : 0.35;
    const isSuccess = Math.random() < catchChance;

    // 晃動動畫 (1, 2, 3 次)
    setCatchShakeStep(1);
    setTimeout(() => {
      sfx.ballShake();
      setCatchShakeStep(2);
      setTimeout(() => {
        sfx.ballShake();
        setCatchShakeStep(3);
        setTimeout(() => {
          if (isSuccess) {
            sfx.catchSuccess();
            setCatchShakeStep(4); // 捕捉成功
            handleCatchSuccess();
          } else {
            sfx.faint();
            setCatchShakeStep(0);
            addLog(`💨 可惜！野生的 ${enemyPokemon.zhName || enemyPokemon.name} 掙脫了精靈球！`);
            setTimeout(() => {
              executeEnemyTurn();
            }, 1000);
          }
        }, 800);
      }, 800);
    }, 800);
  };

  // 收服成功結算
  const handleCatchSuccess = () => {
    addLog(`🎉 太棒了！成功收服了野生的 ${enemyPokemon.zhName || enemyPokemon.name}！已存入圖鑑箱子！`);
    if (!capturedList.some((p) => p.id === enemyPokemon.id)) {
      setCapturedList((prev) => [...prev, enemyPokemon]);
    }
    setWinStreak((prev) => prev + 1);
    setBattleState('caught');
  };

  // 玩家戰勝
  const handleVictory = () => {
    sfx.catchSuccess();
    setEnemyAnim('opacity-0 scale-50 transition-all duration-700');
    addLog(`🏆 對手的 ${enemyPokemon.zhName || enemyPokemon.name} 倒下了！你獲得了勝利！`);
    setWinStreak((prev) => prev + 1);
    setBattleState('won');
  };

  // 對手反擊回合
  const executeEnemyTurn = () => {
    setBattleState('enemyTurn');
    addLog(`⚡ 野生的 ${enemyPokemon.zhName || enemyPokemon.name} 正在凝聚力量進行反擊！`);

    setTimeout(() => {
      setEnemyAnim('-translate-x-6 translate-y-3 scale-105');
      setTimeout(() => {
        setEnemyAnim('');
        setPlayerAnim('animate-bounce brightness-150');

        const enemyDmg = 18 + Math.floor(Math.random() * 16);
        const newPlayerHp = Math.max(0, playerHp - enemyDmg);
        setPlayerHp(newPlayerHp);
        sfx.hit();
        setDamagePopup({ target: 'player', text: `-${enemyDmg}`, type: 'enemy' });
        addLog(`💥 ${enemyPokemon.zhName || enemyPokemon.name} 反擊命中！受到 ${enemyDmg} 點傷害！`);

        setTimeout(() => {
          setPlayerAnim('');
          setDamagePopup(null);

          if (newPlayerHp <= 0) {
            sfx.faint();
            addLog(`💔 你的 ${playerPokemon.zhName || playerPokemon.name} 眼前一片漆黑...`);
            setWinStreak(0);
            setBattleState('lost');
          } else {
            setBattleState('ready');
          }
        }, 900);
      }, 400);
    }, 1000);
  };

  // 篩選世代寶可夢
  const filteredPokemon = useMemo(() => {
    return POPULAR_POKEMON.filter((p) => {
      const matchGen = activeGen === 'all' || p.gen === activeGen;
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.zhName.includes(searchQuery);
      return matchGen && matchSearch;
    });
  }, [activeGen, searchQuery]);

  // 自 PokéAPI 搜尋自訂寶可夢
  const searchCustomFromPokeApi = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setApiLoading(true);
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${searchQuery.toLowerCase().trim()}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      const newPoke = {
        id: data.id,
        name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
        zhName: data.name,
        type: data.types[0].type.name,
        gen: 1
      };
      // 嘗試抓中文名
      try {
        const specRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${data.id}`);
        if (specRes.ok) {
          const specData = await specRes.json();
          const zhObj = specData.names.find((n) => n.language.name === 'zh-Hant' || n.language.name === 'zh-Hans');
          if (zhObj) newPoke.zhName = zhObj.name;
        }
      } catch (err) {}

      setCustomPokemonList((prev) => [newPoke, ...prev.filter((p) => p.id !== newPoke.id)]);
      setPlayerPokemon(newPoke);
    } catch (err) {
      alert('找不到該寶可夢！請輸入正確的英文名稱或全國圖鑑編號（例如 25 或 pikachu）');
    } finally {
      setApiLoading(false);
    }
  };

  // 計算血條百分比與顏色
  const getHpColor = (current, max) => {
    const ratio = current / max;
    if (ratio > 0.5) return 'bg-emerald-500';
    if (ratio > 0.2) return 'bg-amber-400 animate-pulse';
    return 'bg-red-500 animate-pulse';
  };

  const artwork = (id) => `./assets/${id}.png`;
  const typeLabel = (poke) => TYPE_COLORS[poke.type]?.zh || poke.type;
  const difficultyNames = {easy:'初級訓練家', medium:'精英訓練家', hard:'道館館主', champion:'聯盟冠軍'};
  const available = [...customPokemonList.filter(p=>!POPULAR_POKEMON.some(x=>x.id===p.id)), ...filteredPokemon];
  const busy = !['ready','playerTurn','won','lost','caught'].includes(battleState);
  const renderCard = (poke, inBox=false) => <button key={poke.id} className={`pokemon-card ${playerPokemon.id===poke.id?'selected':''} type-${poke.type}`} onClick={()=>{setPlayerPokemon(poke);}} aria-pressed={playerPokemon.id===poke.id} aria-label={`選擇${poke.zhName || poke.name}`}>
    <div className="card-top"><span>No. {String(poke.id).padStart(3,'0')}</span>{playerPokemon.id===poke.id ? <CheckCircle2 size={19}/> : <span className="mini-ball"/>}</div>
    <div className="card-image"><img loading="lazy" src={artwork(poke.id)} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=getStaticSpriteFallback(poke.id);}} alt={poke.zhName || poke.name}/></div>
    <div className="card-name">{poke.zhName || poke.name}</div><div className="card-en">{poke.name}</div><span className={`type-badge type-${poke.type}`}>{typeLabel(poke)}</span>
    <div className="card-bottom">{playerPokemon.id===poke.id?'目前出戰夥伴':inBox?'點選設為夥伴':'點選一起冒險'}<ChevronRight size={14}/></div>
  </button>;
  const hpPanel = (poke, hp, max, level, enemy=false) => <div className={`hp-panel ${enemy?'enemy-hp':'player-hp'}`}>
    <div className="hp-name"><strong>{poke.zhName || poke.name}</strong><span>Lv. {level}</span></div><div className="hp-meta"><span className={`type-badge type-${poke.type}`}>{typeLabel(poke)}</span><span>{enemy?'野生寶可夢':'你的冒險夥伴'}</span></div>
    <div className="hp-track"><span style={{width:`${hp/max*100}%`,background:hp/max>.5?'#4de0a6':hp/max>.2?'#f5cc55':'#ff6a79'}}/></div><div className="hp-numbers"><span>{enemy && hp/max<=.35?'可嘗試收服':'HP 生命值'}</span><b>{hp} <small>/ {max}</small></b></div>
  </div>;
  return <div className="app-shell">
    <header className="site-header"><div className="header-inner"><button className="brand" onClick={()=>{if(!busy || view!=='battle')setView('select')}} aria-label="PokéChinese 首頁"><span className="brand-ball"/><span>POKÉ<span className="yellow">文</span><small>國 文 冒 險 聯 盟</small></span></button>
      <nav aria-label="主要選單"><button className={view==='select'?'active':''} disabled={view==='battle'&&busy} onClick={()=>setView('select')}><Crosshair size={17}/><span>冒險準備</span></button><button className={view==='battle'?'active':''} disabled={view!=='battle'} onClick={()=>setView('battle')}><Zap size={17}/><span>對戰場</span></button><button className={view==='box'?'active':''} disabled={view==='battle'&&busy} onClick={()=>setView('box')}><Award size={17}/><span>我的圖鑑</span><b>{capturedList.length}</b></button></nav>
      <div className="audio-controls"><div className="music-control"><button className={`sound-button music-button ${musicOn?'music-enabled':''}`} onClick={()=>setMusicPanel(!musicPanel)} aria-label="配樂設定" aria-expanded={musicPanel} aria-controls="music-settings" title="配樂設定"><Music2 size={19}/>{musicOn&&musicReady&&<span className="music-status-dot"/>}</button>
      {musicPanel && <section id="music-settings" className="music-settings" aria-label="配樂設定面板"><div className="music-settings-heading"><strong><Music size={17}/> 冒險配樂</strong><button className="music-close" aria-label="關閉配樂設定" onClick={()=>setMusicPanel(false)}><X size={17}/></button></div><p className="music-now">{!musicOn?'配樂已暫停':!musicReady?'點擊操作後，音樂就會開始':`正在播放 · ${musicTitles[musicTheme]}`}</p><button className={`music-toggle ${musicOn?'is-on':''}`} role="switch" aria-checked={musicOn} aria-label="背景配樂" onClick={()=>setMusicOn(!musicOn)}><span>{musicOn?'配樂開啟':'配樂關閉'}</span><span className="toggle-track"><span/></span></button><label className="music-volume-label" htmlFor="music-volume">配樂音量 <b>{Math.round(musicVolume*100)}%</b></label><input id="music-volume" className="music-volume" type="range" min="0" max="100" step="1" value={Math.round(musicVolume*100)} onChange={e=>setMusicVolume(Number(e.target.value)/100)} aria-label="配樂音量"/><small className="music-note">原創 8-bit 旋律，隨場景切換。<br/>右側喇叭可獨立開關遊戲音效。</small></section>}</div>
      <button className="sound-button" onClick={()=>setSoundOn(!soundOn)} aria-label={soundOn?'關閉音效':'開啟音效'} title={soundOn?'關閉音效':'開啟音效'}>{soundOn?<Volume2 size={19}/>:<VolumeX size={19}/>}</button></div>
    </div></header>
    <main className="main-wrap">
      {view==='select' && <>
        <div className="page-eyebrow"><span className="live-dot"/> ADVENTURE AWAITS <span className="eyebrow-line"/> 每一道題，都是冒險的開始</div>
        <section className="learning-summary" aria-label="學習進度"><div><strong>{Object.keys(progress.attempts).filter(k=>k.startsWith(selectedBankId+':')).length}</strong><span>已練習題目</span></div><div><strong>{Object.values(progress.attempts).reduce((s,a)=>s+a.correct,0)}</strong><span>累計答對次數</span></div><div><strong>{Object.values(progress.attempts).filter(a=>!a.lastCorrect).length}</strong><span>待加強題目</span></div><button className="secondary-button" onClick={exportProgress}>下載進度備份</button><label className="secondary-button">還原進度<input type="file" accept=".json,application/json" aria-label="還原進度備份" onChange={restoreProgress} style={{maxWidth:170}}/></label><p>{saveWarning || '進度與圖鑑保存在同一瀏覽器。HTML 內含答案，適合課堂複習與自學。'}</p></section>
        <QuestionBankPanel banks={questionBanks} selectedId={selectedBankId} onChange={changeBank} onImport={importBanks} notice={bankNotice}/>
        <section className="move-legend" aria-label="招式與難度對照">{ATTACK_MOVES.map(m=><div key={m.id}><b>{m.name}</b><span>{m.label} · 傷害 {m.damage}</span><small>{selectedBank?.questions.filter(q=>q.status==='active'&&q.difficulty===m.diff).length||0} 題可挑戰</small></div>)}</section><section className="hero"><div className="hero-copy"><span className="section-label">讓閱讀成為戰鬥力</span><h1>腦力全開，<br/>冒險<span className="yellow">就位。</span></h1><p>與你的寶可夢一起迎戰。<br/>用國文發動招式，把每一次思考變成力量。</p><button className="primary-button" onClick={()=>startBattle(playerPokemon)}><Crosshair size={21}/>開始冒險<ChevronRight size={20}/></button><div className="hero-hint"><Shield size={14}/> 答題對戰 <span>·</span> 野生收服 <span>·</span> 圖鑑收藏</div></div>
          <div className={`hero-art type-${playerPokemon.type}`}><div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="art-index">#{String(playerPokemon.id).padStart(3,'0')}</span><span className="art-star star-one">✦</span><span className="art-star star-two">✧</span><img key={playerPokemon.id} className="hero-pokemon" src={artwork(playerPokemon.id)} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=getStaticSpriteFallback(playerPokemon.id)}} alt={playerPokemon.zhName || playerPokemon.name}/><div className="partner-tag"><span className="live-dot"/> 目前出戰夥伴</div><div className="hero-name"><h2>{playerPokemon.zhName || playerPokemon.name}</h2><span className={`type-badge type-${playerPokemon.type}`}>{typeLabel(playerPokemon)}</span><span>Lv. {playerLevel}</span></div></div>
          <aside className="mission-panel"><div className="panel-kicker"><Trophy size={17}/> TRAINER STATUS</div><h3>準備好迎接挑戰？</h3><div className="stats-row"><div><b>{String(winStreak).padStart(2,'0')}</b><span>目前連勝</span></div><div><b>{String(capturedList.length).padStart(2,'0')}</b><span>已收服夥伴</span></div></div><div className="mission-divider"/><div className="mini-heading">你的冒險指南</div><ol className="steps"><li><span>01</span><div><strong>選一位夥伴</strong><small>找到最合拍的出戰寶可夢</small></div></li><li><span>02</span><div><strong>答題，發動招式</strong><small>選擇招式，挑戰不同難度</small></div></li><li><span>03</span><div><strong>收服新朋友</strong><small>降低對手血量，提高收服機會</small></div></li></ol><div className="mission-tip"><Sparkles size={17}/><span>答錯也沒關係，下個回合再試一次。</span></div></aside>
        </section>
        <section className="roster-section"><div className="section-heading"><div><span className="section-label">CHOOSE YOUR PARTNER</span><h2>你的冒險，誰來同行？<span className="count-label">{available.length} 位夥伴</span></h2></div><form className="search-form" onSubmit={searchCustomFromPokeApi}><Search size={18}/><input aria-label="搜尋寶可夢" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="搜尋名稱或圖鑑編號…"/><button disabled={apiLoading} type="submit" aria-label="從 PokéAPI 搜尋">{apiLoading?'搜尋中':<ChevronRight size={18}/>}</button></form></div>
          <div className="generation-tabs" role="group" aria-label="寶可夢世代"><button className={activeGen==='all'?'selected':''} onClick={()=>setActiveGen('all')}>全部世代</button>{GENERATIONS.map(g=><button key={g.gen} className={activeGen===g.gen?'selected':''} onClick={()=>setActiveGen(g.gen)}>{['','關都','城都','豐緣','神奧','合眾','卡洛斯','阿羅拉','伽勒爾','帕底亞'][g.gen]}<small>GEN {String(g.gen).padStart(2,'0')}</small></button>)}</div>
          <div className="pokemon-grid">{available.map(p=>renderCard(p))}</div>{available.length===0 && <div className="empty-state"><Search size={32}/><h3>這裡還沒有找到夥伴</h3><p>換個世代或名稱，或輸入英文名稱／編號後按右側箭頭搜尋。</p><button className="secondary-button" onClick={()=>{setSearchQuery('');setActiveGen('all')}}>顯示所有夥伴</button></div>}
        </section>
      </>}
      {view==='battle' && <>
        <div className="active-bank-label">目前題庫：{selectedBank?.title || '自動數學練習'}{selectedBank ? ' · 題庫題型與倒數以匯入資料為準' : ''}</div>
        <div className="battle-heading"><div><span className="section-label">WILD ENCOUNTER</span><h1>常青之森<span>野生遭遇戰</span></h1></div><div className="battle-streak"><Trophy size={17}/> {winStreak} 連勝</div></div>
        <div className="battle-layout"><section className="battle-main"><div className={`arena ${damagePopup?'impact':''}`}>
          <Forest/><div className="arena-caption"><span className="live-dot"/> 常青之森 · 晴朗 <Leaf size={14}/></div>
          {hpPanel(enemyPokemon,enemyHp,enemyMaxHp,enemyLevel,true)}{hpPanel(playerPokemon,playerHp,playerMaxHp,playerLevel)}
          <div className="arena-platform enemy-platform"/><div className="arena-platform player-platform"/>
          <div className={`fighter enemy-fighter ${enemyAnim}`}>
            {battleState==='catching'||battleState==='caught'?<div className={`catch-ball step-${catchShakeStep}`}><span/></div>:<img src={artwork(enemyPokemon.id)} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=artwork(enemyPokemon.id)}} alt={`野生的${enemyPokemon.zhName || enemyPokemon.name}`}/>}
          </div><div className={`fighter player-fighter ${playerAnim}`}><img src={artwork(playerPokemon.id)} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=artwork(playerPokemon.id)}} alt={`出戰的${playerPokemon.zhName || playerPokemon.name}`}/></div>
          {damagePopup && <span className={`damage-popup damage-${damagePopup.target}`}>{damagePopup.text}</span>}
          <div className="arena-bottom-fade"/>
        </div>
        <div className="action-panel">
          {questionFeedback && <div className={`question-feedback ${questionFeedback.correct ? 'correct' : 'incorrect'}`} role="status"><strong>{questionFeedback.correct ? '答對了！' : '一起看解答'}</strong><p>{questionFeedback.question}</p><p>正確答案：{questionFeedback.answer}</p><p>{questionFeedback.explanation}</p><small>來源：{questionFeedback.sourceRef}</small></div>}
          {battleState==='mathPending' && currentMath ? <div className="math-panel"><div className="math-top"><span><Zap size={17}/> 答題，發動{selectedMove?.id==='catch'?'收服':'招式'}</span><strong className={mathTimer<=3?'urgent':''}><Clock size={18}/> {mathTimer} 秒</strong></div><div className="timer-track"><span style={{width:`${mathTimer/maxMathTimer*100}%`,background:mathTimer<=3?'#ff6a79':'#f7d65c'}}/></div><div className={`math-question ${currentMath.optionTexts ? 'bank-stem' : ''}`}>{currentMath.question}{currentMath.optionTexts || currentMath.question.includes('=') ? '' : ' = ?'}</div><div className={`answer-grid ${currentMath.optionTexts ? 'bank-options' : ''}`}>{currentMath.options.map((opt,i)=><button key={i} onClick={()=>handleAnswerSubmit(opt)}><small>{String.fromCharCode(65+i)}</small><b>{currentMath.optionTexts ? currentMath.optionTexts[opt] : opt}</b><ChevronRight size={18}/></button>)}</div><p className="math-footnote">讀清題目，選出正確答案。</p></div> : ['ready','playerTurn'].includes(battleState) ? <><div className="action-heading"><div><span className="live-dot"/> 你的回合</div><span>選擇招式，用答案發動力量</span></div><div className="move-grid">{moves.map((m,i)=><button key={m.id} className={`move-button move-${m.id} ${m.id==='catch'&&enemyHp/enemyMaxHp<=.35?'catch-ready':''}`} disabled={!!selectedBank&&!selectedBank.questions.some(q=>q.status==='active'&&q.difficulty===m.diff)} onClick={()=>handleSelectMove(m)}><span className="move-icon">{m.id==='catch'?<span className="mini-ball"/>:<Zap size={23}/>}</span><div><strong>{m.name}</strong><small>{m.id==='catch'?'答對嘗試收服 · '+m.label+'題':m.label+'題 · 答對固定傷害 '+m.damage}</small></div><ChevronRight size={17}/></button>)}</div></> : ['won','caught','lost'].includes(battleState)?<div className={`result-panel result-${battleState}`}><span className="result-icon">{battleState==='lost'?<Heart size={32}/>:<Trophy size={32}/>}</span><h2>{battleState==='won'?'漂亮的一戰！':battleState==='caught'?'新的冒險夥伴！':'休息一下，再出發。'}</h2><p>{battleState==='caught'?`${enemyPokemon.zhName || enemyPokemon.name} 已加入你的圖鑑。`:battleState==='won'?'你的思考，成了最強的力量。':'每一次練習，都讓你更靠近勝利。'}</p><div className="result-actions"><button className="primary-button" onClick={()=>{if(battleState==='lost')startBattle(playerPokemon);else spawnEnemy();}}>{battleState==='lost'?'恢復體力再挑戰':'探索下一場對戰'}<ChevronRight size={18}/></button><button className="secondary-button" onClick={()=>setView('box')}>查看圖鑑</button></div></div>:<div className="turn-message" role="status"><span className="loading-orb"/><strong>{battleLogs[0]?.replace(/^[^\u4e00-\u9fff]+/,'') || '對戰進行中…'}</strong></div>}
        </div></section>
        <aside className="battle-sidebar"><div className="log-panel"><div className="panel-kicker"><Shield size={17}/> BATTLE LOG</div><h3>每一回合，都在進步。</h3><div className="battle-logs" aria-live="polite">{battleLogs.map((log,i)=><div key={`${i}-${log}`} className={i===0?'latest':''}><span className="log-dot"/><p>{log.replace(/^[^\u4e00-\u9fff]+/,'')}</p></div>)}</div></div><div className="battle-guide"><HelpCircle size={20}/><h4>訓練家的小提醒</h4><p>{selectedBank ? '招式由難到易排列：破壞光線 150、打雷 110、十萬伏特 90、電擊波 60、電擊 40。答對才造成固定傷害。' : '快速衝擊練加減法，屬性特攻練乘除與加法，全力暴擊挑戰混合四則。'}</p><p>對手 HP 低於 35% 時，試試精靈球！</p></div></aside></div>
      </>}
      {view==='box' && <section className="collection"><div className="page-eyebrow"><span className="live-dot"/> YOUR ADVENTURE JOURNAL</div><div className="collection-heading"><div><span className="section-label">每一次相遇，都值得收藏</span><h1>我的夥伴圖鑑<span className="yellow">。</span></h1><p>這些夥伴，見證了你的每一次成長。點選卡片就能更換出戰夥伴。</p></div><div className="collection-count"><Award size={24}/><b>{capturedList.length}</b><span>位冒險夥伴</span></div></div><div className="pokemon-grid collection-grid">{capturedList.map(p=>renderCard(p,true))}</div><div className="collection-cta"><div><h3>下一位夥伴，正在等你。</h3><p>回到冒險準備，繼續用數學探索世界。</p></div><button className="primary-button" onClick={()=>setView('select')}>繼續冒險<ChevronRight size={18}/></button></div></section>}
    </main><footer className="site-footer"><span>POKÉMATH <span className="footer-separator">/</span> 讓思考，成為冒險的力量。</span><small>非官方教學作品 · 圖像來源 PokéAPI · 本次收服紀錄於重新整理後重設</small></footer>
  </div>;
}

function Forest(){return <svg className="forest" viewBox="0 0 1000 550" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="sky" x2="0" y2="1"><stop stopColor="#8bd3be"/><stop offset=".65" stopColor="#cae8af"/><stop offset="1" stopColor="#6eac75"/></linearGradient><linearGradient id="ground" x2="0" y2="1"><stop stopColor="#70b184"/><stop offset="1" stopColor="#164a48"/></linearGradient><radialGradient id="sun"><stop stopColor="#fff5bd" stopOpacity=".7"/><stop offset="1" stopColor="#fff5bd" stopOpacity="0"/></radialGradient></defs><rect width="1000" height="550" fill="url(#sky)"/><circle cx="650" cy="100" r="220" fill="url(#sun)"/><path d="M0 310Q170 205 350 285T750 260T1000 250V550H0" fill="#9bc8a0"/><g fill="#629d88" opacity=".5">{[20,125,240,370,500,650,780,920].map((x,i)=><g key={x}><rect x={x} y={60+i%3*30} width="18" height="300"/><ellipse cx={x+9} cy={90+i%3*30} rx="74" ry="95"/></g>)}</g><path d="M0 355Q250 275 500 330T1000 320V550H0" fill="url(#ground)"/><path d="M600 310Q460 360 570 550H900Q550 380 680 310" fill="#b6c78a" opacity=".25"/><g fill="#286958">{[-50,80,925,1050].map((x,i)=><g key={x}><path d={`M${x} 0L${x+20} 370L${x+65} 370L${x+70} 0Z`} fill="#29554c"/><ellipse cx={x+30} cy={60} rx="150" ry="130"/><ellipse cx={x+90} cy={0} rx="170" ry="120"/></g>)}</g><g fill="#163f3b"><path d="M0 470Q80 420 170 500L220 550H0Z"/><path d="M1000 390Q940 410 880 550H1000Z"/><path d="M30 550L4 435L70 505L65 455L110 540L120 480L160 550Z"/><path d="M900 550L920 480L940 520L980 440L970 530L1000 480V550Z"/></g><g fill="#eaf6b2" opacity=".75"><circle cx="270" cy="220" r="3"/><circle cx="590" cy="120" r="2"/><circle cx="720" cy="280" r="3"/><circle cx="420" cy="340" r="2"/><circle cx="800" cy="180" r="2"/></g></svg>}
