import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const stats=readFileSync(new URL('./stats.mjs',import.meta.url),'utf8').replace('export function','function');
const APP=stats+'\n'+readFileSync(new URL('./app.mjs',import.meta.url),'utf8').replace("import {stats} from './stats.mjs';",'');
const HTML=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const assets='const HTML='+JSON.stringify(HTML)+';\nconst APP='+JSON.stringify(APP)+';\n';
writeFileSync(new URL('./assets.mjs',import.meta.url),'export const HTML='+JSON.stringify(HTML)+';\nexport const APP='+JSON.stringify(APP)+';\n');
mkdirSync(new URL('./dist',import.meta.url),{recursive:true});
writeFileSync(new URL('./dist/worker.mjs',import.meta.url),assets+readFileSync(new URL('./worker.mjs',import.meta.url),'utf8').replace("import {HTML,APP} from './assets.mjs';",''));
