import type { FastifyInstance } from 'fastify';
import { getPool } from '@/persistence/client';
import { getRedisClient } from '@/persistence/redis-client';
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (_request, reply) => {
    const checks: Array<{name:string;status:'ok'|'degraded'|'failing';responseTimeMs:number;message:string;lastChecked:string}> = [];
    const check=async(name:string,fn:()=>Promise<void>)=>{const started=Date.now();try{await fn();checks.push({name,status:'ok',responseTimeMs:Date.now()-started,message:'Available',lastChecked:new Date().toISOString()});}catch(error){checks.push({name,status:'failing',responseTimeMs:Date.now()-started,message:error instanceof Error?error.message:'Unavailable',lastChecked:new Date().toISOString()});}};
    await check('api',async()=>undefined);
    await check('database',async()=>{await getPool().query('SELECT 1');});
    await check('redis',async()=>{await getRedisClient().ping();});
    const anyFailing=checks.some((item)=>item.status==='failing'); const status = anyFailing?'unhealthy':'healthy';
    reply.status(anyFailing?503:200).send({data:{status,checks,timestamp:new Date().toISOString(),version:process.env.npm_package_version||'1.1.0'}});
  });
}
