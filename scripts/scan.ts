/** Internal local CLI. Never schedule this on a remote host without operator approval. */
import { scanIntelligence } from '../src/lib/intelligence';
import { db } from '../src/lib/db';
async function main(){
 if(process.env.DATABASE_URL && process.env.WASLI_ALLOW_MANAGED_JOB!=='true')throw new Error('Managed database scans require an explicitly approved deployment and WASLI_ALLOW_MANAGED_JOB=true');
 const result=await scanIntelligence('cli');console.log(JSON.stringify(result,null,2));
 await(await db()).close();if(result.status==='failed')process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Intelligence scan failed');process.exitCode=1;});
