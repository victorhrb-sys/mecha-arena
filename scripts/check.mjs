import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
for (const dir of ['dist', 'multiplayer', 'scripts', 'simulations']) {
  for (const file of readdirSync(dir).filter(file => /\.(mjs|js)$/.test(file))) execFileSync(process.execPath, ['--check', `${dir}/${file}`], {stdio: 'inherit'});
}
execFileSync(process.execPath, ['--check', 'server.mjs'], {stdio: 'inherit'});
console.log('Sintaxe dos módulos do jogo, servidor e scripts validada.');
