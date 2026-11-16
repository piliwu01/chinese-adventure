import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const exe=path.resolve(root,'../build-tools/esbuild.exe');
const ids=['src/App.jsx','src/QuestionBankPanel.jsx','src/question-bank.js','src/game-rules.js','src/music.js','src/main.jsx'];
const sources=Object.fromEntries(ids.map(id=>[id,fs.readFileSync(path.join(root,id),'utf8')]));
const vendor={react:'react/cjs/react.production.js','react-dom':'react-dom/cjs/react-dom.production.js','react-dom/client':'react-dom/cjs/react-dom-client.production.js',scheduler:'scheduler/cjs/scheduler.production.js','lucide-react':'lucide-react/dist/cjs/lucide-react.js'};
for(const [id,p] of Object.entries(vendor))sources[id]=fs.readFileSync(path.join(root,'node_modules',p),'utf8');
const modules=[];
for(const [id,source] of Object.entries(sources)){
 const r=spawnSync(exe,['--loader=jsx','--format=cjs','--target=es2020','--minify','--define:process.env.NODE_ENV="production"'],{input:source,encoding:'utf8',cwd:root,maxBuffer:20e6,windowsHide:true});
 if(r.status!==0)throw new Error(id+': '+r.stderr);
 modules.push(JSON.stringify(id)+':function(require,module,exports){'+r.stdout+'\n}');
}
modules.push('"src/default-bank.json":function(require,module){module.exports='+fs.readFileSync(path.join(root,'src/default-bank.json'),'utf8')+';}');
const runtime=`(function(){const modules={${modules.join(',')}};const cache={};function resolve(name,parent){if(name.endsWith('.css'))return 'css';if(!name.startsWith('.'))return name;const p=parent.split('/');p.pop();for(const v of name.split('/')){if(v==='.')continue;if(v==='..')p.pop();else p.push(v);}const id=p.join('/');return modules[id]?id:modules[id+'.js']?id+'.js':id+'.jsx';}function load(id){if(id==='css')return {};if(cache[id])return cache[id].exports;if(!modules[id])throw new Error('Missing module '+id);const m={exports:{}};cache[id]=m;modules[id](name=>load(resolve(name,id)),m,m.exports);return m.exports;}load('src/main.jsx');})();`;
fs.mkdirSync(path.join(root,'dist/assets'),{recursive:true});
fs.writeFileSync(path.join(root,'dist/assets/app.js'),runtime);
fs.writeFileSync(path.join(root,'dist/assets/app.css'),fs.readFileSync(path.join(root,'src/style.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/banks.css'),'utf8'));
let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<script type="module" src="/src/main.jsx"></script>','<script defer src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css"/>');
fs.writeFileSync(path.join(root,'dist/index.html'),html);
fs.cpSync(path.join(root,'public'),path.join(root,'dist'),{recursive:true});
console.log(JSON.stringify({compiled:Object.keys(sources).length,bytes:Buffer.byteLength(runtime)}));
