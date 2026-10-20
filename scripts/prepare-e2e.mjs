import {rm,readFile} from 'node:fs/promises';
import path from 'node:path';
const pkg=JSON.parse(await readFile('package.json','utf8'));
if(pkg.name!=='wasli-os')throw new Error('Run browser validation from WASLI OS root');
// This directory is exclusively disposable browser-test data, never user storage.
await rm(path.join(process.cwd(),'.data','e2e'),{recursive:true,force:true});
