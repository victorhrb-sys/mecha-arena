import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {BOT_PROFILES} from '../dist/bots.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.resolve(root, process.argv[2] ?? 'reports/balance-v01f');
const data = JSON.parse(await readFile(path.join(folder, 'summary.json'), 'utf8'));
const names = {A: 'Canhão', K: 'Propulsor', Q: 'Escudo', J: 'Coletor'};
const profiles = {...Object.fromEntries(Object.entries(BOT_PROFILES).map(([id, p]) => [id, p.name])), legacy: 'Clássico'};
const stages = {opening: 'Início', middle: 'Meio', late: 'Avançado'};
const archetypes = {attack: 'Ataque', race: 'Corrida', defense: 'Defesa', economy: 'Economia'};
const pct = n => (100 * n).toFixed(1).replace('.', ',') + '%';
const pp = n => (n >= 0 ? '+' : '') + (n * 100).toFixed(1).replace('.', ',') + ' p.p.';
const ci = a => a.map(pct).join('–');
const size = n => n.toLocaleString('pt-BR');
const totalMatches = data.metadata.fullMatches + data.metadata.choiceMatches;
const allCensored = data.metadata.censoredMatches + data.metadata.censoredChoiceMatches;
const controlledCensored = data.cards.reduce((n, c) => n + c.normal.censored + c.improved.censored, 0)
  + data.matchups.reduce((n, c) => n + c.censored, 0) + data.interventions.reduce((n, c) => n + c.beforeStats.censored + c.afterStats.censored, 0);
const leaders = {};
for (const stage of Object.keys(stages)) for (const count of [2, 3, 4]) for (const level of ['normal', 'improved']) {
  const leader = data.cards.filter(c => c.stage === stage && c.count === count).sort((a, b) => b[level].winRate - a[level].winRate)[0];
  leaders[leader.type] = (leaders[leader.type] ?? 0) + 1;
}
const leadingType = Object.keys(leaders).sort((a, b) => leaders[b] - leaders[a])[0];
let findings;
try {findings = JSON.parse(await readFile(path.join(folder, 'findings.json'), 'utf8'));}
catch (error) {if (error.code !== 'ENOENT') throw error; findings = [
  {title: 'Vantagens dependem do contexto', text: `${names[leadingType]} teve a maior estimativa em ${leaders[leadingType]} dos 18 cenários de substituição. Essa contagem é descritiva e não mede significância nem todas as montagens possíveis.`},
  {title: 'Economia precisa de horizonte', text: 'O Coletor gera recursos para arenas futuras. Compare as escolhas iniciais em 0–0 e 4–4 antes de concluir sobre seu equilíbrio.'},
  {title: 'Bots são hipóteses', text: 'Seis estilos variados e um controle clássico permitem testar mais estratégias. Ainda não houve calibração com partidas humanas.'}
];}
const markdown = `# Mecha Arena v0.1f — rodada de simulações

${size(data.metadata.controlledArenas)} arenas controladas; ${size(data.metadata.fullMatches)} partidas no torneio; ${size(data.metadata.choiceMatches)} partidas com escolha inicial controlada. Semente ${data.metadata.seed}. Regras da v0.1f preservadas.

${findings.map(f => `## ${f.title}\n\n${f.text}`).join('\n\n')}

## Carta acrescentada à montagem

Taxa de vitória na arena. Cada célula tem ${size(data.metadata.samples)} repetições. A linha compara uma carta no mesmo espaço, preservando a base e os adversários. “Melhorada” não desconta o custo de aquisição.

| Etapa | Jogadores | Carta | Comum (IC 95%) | Melhorada (IC 95%) | Ganho da melhoria |
|---|---:|---|---|---|---:|
${data.cards.map(c => `| ${stages[c.stage]} | ${c.count} | ${names[c.type]} | ${pct(c.normal.winRate)} (${ci(c.normal.ci)}) | ${pct(c.improved.winRate)} (${ci(c.improved.ci)}) | ${pp(c.upgrade.delta)} |`).join('\n')}

## Confrontos entre montagens

Vitórias de A e B não somam 100% quando há empate. Faces embaralhadas e assentos alternados.

| Etapa | Montagem A | Montagem B | Vitória A | Vitória B | Empate | Limite |
|---|---|---|---:|---:|---:|---:|
${data.matchups.map(c => `| ${stages[c.stage]} | ${archetypes[c.a]} | ${archetypes[c.b]} | ${pct(c.winRate)} | ${pct((c.n - c.wins - c.draws - c.censored) / c.n)} | ${pct(c.draws / c.n)} | ${c.censored} |`).join('\n')}

## Intervenções no início

A tripla compara duas comuns + apoio com a melhorada + apoio; a terceira carta dispara a combinação. Não é “três comuns equipadas”, um estado que as regras não permitem. O custo da terceira carta e o uso futuro da vaga livre ficam fora deste teste imediato.

| Experimento | Antes | Depois | Variação de vitória | IC 95% da diferença |
|---|---|---|---:|---|
${data.interventions.map(c => `| ${c.id} | ${c.before.map(t => t ?? 'vazio').join(' / ')} | ${c.after.map(t => t ?? 'vazio').join(' / ')} | ${pp(c.delta)} | ${c.ci.map(pp).join(' a ')} |`).join('\n')}

## Torneio completo

Taxas de vitória na partida até 5 pontos. O referencial de uma mesa simétrica é 50%, 33,3% e 25% para 2, 3 e 4 participantes. O perfil mede uma política inteira, não o efeito isolado de uma carta.

| Jogadores | Perfil | Partidas | Vitórias | Taxa (IC 95%) | Melhorias pagas por partida | Triplas por partida |
|---|---|---:|---:|---|---:|---:|
${data.tournament.map(s => `| ${s.count} | ${profiles[s.profile]} | ${s.n} | ${s.wins} | ${pct(s.winRate)} (${ci(s.ci)}) | ${(s.upgrades / s.n).toFixed(2)} | ${(s.triples / s.n).toFixed(2)} |`).join('\n')}

## Horizonte econômico da terceira carta

Mesmos K + Q iniciais, adversário, semente e assento por comparação; a terceira carta é concedida. Depois disso, compras, melhorias e montagem seguem a política do perfil. São ${data.metadata.matches} partidas por célula. Placar 4–4 com três módulos é um cenário de isolamento do horizonte, não uma estimativa do equipamento típico no fim.

| Perfil focal | Placar inicial | Terceira carta | Vitória na partida (IC 95%) | Arenas em média | Coletor menos esta carta (IC 95%) |
|---|---|---|---|---:|---|
${data.openingChoices.map(c => `| ${profiles[c.profile]} | ${c.initialPoints}–${c.initialPoints} | ${names[c.type]} | ${pct(c.winRate)} (${ci(c.ci)}) | ${c.avgRounds.toFixed(1)} | ${c.collectorVsThis ? `${pp(c.collectorVsThis.delta)} (${c.collectorVsThis.ci.map(pp).join(' a ')})` : '—'} |`).join('\n')}

## Validade e limites

${allCensored} partidas interrompidas por limite; ${controlledCensored} execuções controladas interrompidas. Limites não foram classificados como empates. Intervalos exploratórios, sem correção por múltiplas comparações. Mesma semente não garante dados iguais depois de decisões divergentes. As montagens são legais e conservam o baralho, mas as bases escolhidas não cobrem todo o espaço estratégico. Não houve calibração humana nem ajuste dos pesos após observar esta rodada.

A ordem de módulos também muda a precedência dos efeitos; os testes de carta embaralham faces, e as intervenções de face medem mudanças específicas. O Escudo aumenta HP passivo; o Coletor exige medir retorno econômico. A melhoria paga de 12 sucatas acontece no torneio, mas a comparação “comum/melhorada” nas arenas não é uma estimativa do retorno desse gasto.

O protocolo completo está em [SIMULACOES.md](../../docs/SIMULACOES.md). Parâmetros, resumos e hashes estão em [summary.json](summary.json); trajetórias em [matches.jsonl](matches.jsonl) e [opening-choices.jsonl](opening-choices.jsonl).

## Reproduzir

\`\`\`sh
node simulations/run.mjs --samples ${data.metadata.samples} --matches ${data.metadata.matches} --seed ${data.metadata.seed}
node simulations/report.mjs
\`\`\`
`;
await writeFile(path.join(folder, 'RELATORIO.md'), markdown);
const compact = {...data}; delete compact.matches;
compact.findings = findings;
const json = JSON.stringify(compact).replace(/</g, '\\u003c');
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simulações · Mecha Arena v0.1f</title><meta name="description" content="Comparação de cartas, melhorias e estratégias nas simulações da v0.1f de Mecha Arena."><style>
:root{color-scheme:dark;--bg:#10151c;--panel:#1a222d;--muted:#adbacb;--border:#344357;--accent:#60d6df;font-family:system-ui,sans-serif;color:#eff5fc;background:var(--bg)}*{box-sizing:border-box}body{margin:0;font-size:16px;line-height:1.55}main{max-width:1200px;margin:auto;padding:28px 24px 64px}a{color:var(--accent)}header{display:flex;justify-content:space-between;gap:24px;align-items:center;border-bottom:1px solid var(--border);padding-bottom:16px}.brand{font-size:14px;letter-spacing:.13em;font-weight:800}h1{font-size:clamp(26px,4vw,40px);line-height:1.2;margin:20px 0 10px}h2{font-size:23px;line-height:1.3;margin:0 0 12px}h3{font-size:18px;margin:0 0 8px}p{margin:8px 0 16px}small,.muted{color:var(--muted)}small{font-size:14px}.lead{max-width:880px;color:var(--muted)}.numbers{display:flex;flex-wrap:wrap;gap:16px 40px;margin:24px 0}.numbers b{display:block;font-size:26px}.findings{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:24px 0 36px}.finding{border-top:3px solid var(--accent);background:var(--panel);padding:20px}.finding p{font-size:16px;margin:0}.section{margin-top:40px;padding-top:28px;border-top:1px solid var(--border)}.controls{display:flex;gap:16px;flex-wrap:wrap;padding:16px 0}label{display:grid;gap:6px;font-size:14px;font-weight:700}select{font:inherit;font-size:16px;padding:9px 32px 9px 12px;background:var(--panel);color:inherit;border:1px solid var(--border);border-radius:6px}select:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.table-wrap{overflow:auto;margin-top:16px}table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:left}caption{text-align:left;color:var(--muted);padding-bottom:12px;font-size:14px}th,td{padding:13px 14px;border-bottom:1px solid var(--border)}thead th{color:var(--muted);font-size:14px;font-weight:600}tbody th{font-size:16px}.rates td{min-width:175px}.bar{height:5px;background:#293646;margin-top:7px;width:140px}.bar i{display:block;height:100%;background:var(--accent)}.matrix td{font-weight:700;text-align:center;min-width:110px}.matrix th{font-size:14px}.base{padding:12px 16px;background:var(--panel);border-left:3px solid var(--accent);font-size:14px}.delta{color:var(--accent)}.note{max-width:960px;color:var(--muted);font-size:14px}summary{cursor:pointer;font-weight:700}details{margin-top:24px;border:1px solid var(--border);padding:18px}details p{max-width:1000px}footer{margin-top:40px;color:var(--muted);font-size:14px}.badge{font-size:14px;padding:4px 10px;border:1px solid var(--border);border-radius:20px}.nowrap{white-space:nowrap}@media(max-width:850px){.findings{grid-template-columns:1fr}.finding{padding:16px}main{padding:20px 16px 40px}.controls{gap:12px}header{align-items:start}.numbers{gap:16px 24px}}
</style></head><body><main><header><div class="brand">MECHA ARENA <span class="badge">v0.1f</span></div><a href="/">Voltar ao jogo</a></header><h1>O que as simulações mostram</h1><p class="lead">Cartas, melhorias e estilos em disputa. As regras da v0.1f foram preservadas. Os resultados descrevem os cenários testados; os bots ainda precisam ser comparados com jogadores humanos.</p><div class="numbers"><div><b>${size(data.metadata.controlledArenas)}</b><small>arenas controladas</small></div><div><b>${size(totalMatches)}</b><small>partidas completas</small></div><div><b>6 + 1</b><small>estilos novos + controle clássico</small></div><div><b>${allCensored + controlledCensored}</b><small>execuções interrompidas por limite</small></div></div><div class="findings" id="findings"></div>
<section class="section"><h2>Qual carta acrescentar?</h2><p class="lead">Troque uma única carta e mantenha a mesma base. Compare a vitória na arena e o ganho da melhoria; o custo de adquirir a carta melhorada fica fora deste teste.</p><div class="controls"><label>Equipamento<select id="stage"><option value="opening">Início · 3 módulos</option><option value="middle">Meio · 5 módulos</option><option value="late">Avançado · 6 módulos</option></select></label><label>Participantes<select id="players"><option value="2">2 jogadores</option><option value="3">3 jogadores</option><option value="4">4 jogadores</option></select></label></div><p class="base" id="base"></p><div class="table-wrap"><table class="rates"><caption>${size(data.metadata.samples)} repetições por carta e nível. Intervalos de 95% entre parênteses.</caption><thead><tr><th>Carta testada</th><th>Comum · vitória</th><th>Melhorada · vitória</th><th>Ganho da melhoria</th><th>Sucata dos Coletores<br><small>comum / melhorada</small></th></tr></thead><tbody id="cards"></tbody></table></div><p class="note">A sucata é a produção média de todos os Coletores do robô focal, sem o prêmio de participação. O Coletor não muda o resultado da arena por meio da sucata; seu valor econômico aparece nas partidas completas abaixo. Empates contam como ausência de vitória.</p></section>
<section class="section"><h2>Os confrontos formam um ciclo?</h2><p class="lead">Chance de a montagem da linha vencer a montagem da coluna em um duelo. As faces são embaralhadas; a etapa acompanha o filtro acima.</p><div class="table-wrap"><table class="matrix"><caption id="matrix-caption"></caption><thead id="matrix-head"></thead><tbody id="matrix"></tbody></table></div><div class="base" id="builds"></div></section>
<section class="section"><h2>A tripla melhora o robô imediatamente?</h2><p class="lead">Adquirir a terceira comum combina duas cartas já equipadas em uma melhorada e libera uma face. Aqui medimos o efeito na próxima arena; o custo de compra e o preenchimento posterior da vaga não entram.</p><div class="table-wrap"><table><thead><tr><th>Tripla</th><th>Antes</th><th>Depois</th><th>Mudança de vitória</th><th>IC 95% da diferença</th></tr></thead><tbody id="triples"></tbody></table></div></section>
<section class="section"><h2>O investimento no Coletor se paga?</h2><p class="lead">Conceder K + Q + uma terceira carta e jogar até cinco pontos. Compare começar em 0–0 ou 4–4. Em ambos os casos são três módulos iniciais, para isolar o horizonte de pontuação.</p><div class="controls"><label>Perfil do piloto<select id="economic-profile"><option value="balanced">Equilibrado</option><option value="investor">Investidor</option></select></label></div><div class="table-wrap"><table><caption>${data.metadata.matches} partidas por célula. Mesmas condições iniciais em cada comparação.</caption><thead><tr><th>Terceira carta</th><th>Vitória a partir de 0–0</th><th>Vitória a partir de 4–4</th><th>Coletor menos esta carta<br><small>0–0 · IC 95%</small></th></tr></thead><tbody id="economy"></tbody></table></div><p class="note">A carta inicial é concedida, sem simular a chance de encontrá-la no draft. As políticas escolhem livremente nas arenas seguintes. IC da diferença incluindo zero significa que esta amostra não separa as opções com clareza.</p></section>
<section class="section"><h2>Quem vence partidas completas?</h2><p class="lead">Draft, compras, sucata, triplas e melhorias pagas seguem todas as regras. O filtro de participantes acima também controla esta tabela.</p><div class="table-wrap"><table><caption id="tournament-caption"></caption><thead><tr><th>Perfil</th><th>Vitórias / partidas</th><th>Taxa de vitória · IC 95%</th><th>Melhorias pagas<br><small>por partida</small></th><th>Triplas<br><small>por partida</small></th><th>J no draft</th></tr></thead><tbody id="tournament"></tbody></table></div><p class="note">O sucesso de um perfil combina suas escolhas de cartas, montagem e gastos. Ele não demonstra sozinho o poder de uma carta. A coluna J mostra a fração de escolhas iniciais dedicadas ao Coletor.</p></section>
<details><summary>Método, posições dos módulos e limites</summary><p>Arenas controladas usam montagens legais de ataque, corrida e defesa, conservando oito cartas de cada tipo. As bases não cobrem todas as combinações. As posições dos módulos variam e o piloto focal troca de assento. Nas mesas mistas, todos os perfis passam por todos os assentos em cada bloco.</p><p>As mesmas sementes alinham cenários iniciais. Sequências de sorteios podem divergir após ações diferentes. IC de Wilson para taxas; IC normal sobre diferenças pareadas para intervenções. São intervalos exploratórios, sem correção por comparações múltiplas. Limites de 600 rolagens por arena, 100 arenas e 15.000 ações por partida; interrupções são censuras separadas dos empates.</p><div class="table-wrap"><table><thead><tr><th>Intervenção pontual</th><th>Variação na vitória</th><th>IC 95%</th></tr></thead><tbody id="other-interventions"></tbody></table></div><p>O primeiro Escudo concede HP passivo. Antecipar uma face pode permitir agir antes de uma eliminação ou chegada adversária; o efeito depende da montagem. O cenário de equipamento avançado não é equivalente ao cenário de placar 4–4.</p><p>Os seis estilos são hipóteses sobre comportamentos humanos. Novas partidas usam esses perfis; salvamentos antigos conservam os bots clássicos. Os pesos e as regras foram preservados durante a medição.</p></details><footer>Fotografia desta rodada · Semente ${data.metadata.seed} · ${size(data.metadata.fullMatches)} partidas de torneio + ${size(data.metadata.choiceMatches)} de escolha inicial. Abra o jogo pelo endereço local habitual para experimentar os bots.</footer></main><script id="results" type="application/json">${json}</script><script>
const data=JSON.parse(document.querySelector('#results').textContent), names=${JSON.stringify(names)}, profiles=${JSON.stringify(profiles)}, archetypes=${JSON.stringify(archetypes)};
const el=id=>document.getElementById(id), pct=n=>(n*100).toFixed(1).replace('.',',')+'%', pp=n=>(n>=0?'+':'')+(n*100).toFixed(1).replace('.',',')+' p.p.', ci=a=>a.map(pct).join('–'), diff=a=>a.map(pp).join(' a '), token=t=>t?names[t[0]]+(t.includes('*')?' ★':''):'vazio';
data.findings.slice(0,3).forEach(f=>{const item=document.createElement('article');item.className='finding';const title=document.createElement('h3'),text=document.createElement('p');title.textContent=f.title;text.textContent=f.text;item.append(title,text);el('findings').append(item)});
function rate(s){return '<b>'+pct(s.winRate)+'</b><br><small>('+ci(s.ci)+')</small>'}
function render(){const stage=el('stage').value,count=Number(el('players').value),spec=data.metadata.stages[stage];
el('base').textContent='Base preservada: '+spec.background.map(token).join(' + ')+'. Uma posição adicional recebe a carta testada; faces e assentos variam.';
el('cards').innerHTML=data.cards.filter(c=>c.stage===stage&&c.count===count).map(c=>'<tr><th>'+names[c.type]+'</th><td>'+rate(c.normal)+'<div class="bar"><i style="width:'+100*c.normal.winRate+'%"></i></div></td><td>'+rate(c.improved)+'<div class="bar"><i style="width:'+100*c.improved.winRate+'%"></i></div></td><td>'+pp(c.upgrade.delta)+'<br><small>'+diff(c.upgrade.ci)+'</small></td><td>'+c.normal.avgScrap.toFixed(2)+' / '+c.improved.avgScrap.toFixed(2)+'</td></tr>').join('');
const keys=Object.keys(archetypes);el('matrix-caption').textContent=spec.name+' · '+data.metadata.samples+' arenas por confronto. Empates ficam fora das duas taxas de vitória.';
el('matrix-head').innerHTML='<tr><th>Linha vence coluna</th>'+keys.map(k=>'<th>'+archetypes[k]+'</th>').join('')+'</tr>';
el('matrix').innerHTML=keys.map(a=>'<tr><th>'+archetypes[a]+'</th>'+keys.map(b=>{if(a===b)return '<td>—</td>';const c=data.matchups.find(c=>c.stage===stage&&((c.a===a&&c.b===b)||(c.a===b&&c.b===a)));const p=c.a===a?c.winRate:(c.n-c.wins-c.draws-c.censored)/c.n;return '<td style="background:rgba(96,214,223,'+(p*.32)+')">'+pct(p)+'</td>'}).join('')+'</tr>').join('');
el('builds').innerHTML=keys.map(k=>'<div><b>'+archetypes[k]+': </b>'+spec.builds[k].map(token).join(' · ')+'</div>').join('');
el('tournament-caption').textContent=count+' participantes · referência simétrica: '+pct(1/count)+'.';
el('tournament').innerHTML=data.tournament.filter(c=>c.count===count).sort((a,b)=>b.winRate-a.winRate).map(c=>'<tr><th>'+profiles[c.profile]+'</th><td>'+c.wins+' / '+c.n+'</td><td>'+rate(c)+'</td><td>'+(c.upgrades/c.n).toFixed(2)+'</td><td>'+(c.triples/c.n).toFixed(2)+'</td><td>'+pct(c.draft.J/(c.n*3))+'</td></tr>').join('');
const profile=el('economic-profile').value;el('economy').innerHTML=Object.keys(names).map(type=>{const a=data.openingChoices.find(c=>c.profile===profile&&c.initialPoints===0&&c.type===type),b=data.openingChoices.find(c=>c.profile===profile&&c.initialPoints===4&&c.type===type);return '<tr><th>'+names[type]+'</th><td>'+rate(a)+'</td><td>'+rate(b)+'</td><td>'+(a.collectorVsThis?pp(a.collectorVsThis.delta)+'<br><small>'+diff(a.collectorVsThis.ci)+'</small>':'—')+'</td></tr>'}).join('');}
el('triples').innerHTML=data.interventions.filter(c=>c.id.startsWith('triple')).map(c=>'<tr><th>'+names[c.id.slice(-1)]+'</th><td>'+c.before.map(token).join(' · ')+'</td><td>'+c.after.map(token).join(' · ')+'</td><td>'+pp(c.delta)+'</td><td>'+diff(c.ci)+'</td></tr>').join('');
const labels={'shield-first':'Adicionar primeiro Escudo a K + J','cannon-first-face':'Canhão: face 2 → 1, trocando com Q','thruster-first-face':'Propulsor: face 3 → 1, trocando com A'};
el('other-interventions').innerHTML=data.interventions.filter(c=>!c.id.startsWith('triple')).map(c=>'<tr><th>'+labels[c.id]+'</th><td>'+pp(c.delta)+'</td><td>'+diff(c.ci)+'</td></tr>').join('');
['stage','players','economic-profile'].forEach(id=>el(id).addEventListener('change',render));render();
</script></body></html>`;
await writeFile(path.join(root, 'dist/balance.html'), html);
console.log(`Relatório: ${path.join(folder, 'RELATORIO.md')}\nPainel: ${path.join(root, 'dist/balance.html')}`);

