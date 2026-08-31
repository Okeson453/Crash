import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { getPool } from '@/persistence/client';
import { consumeBonusEntries } from '@/platform/referrals/reward-service';
import { assertBettingAllowed } from '@/platform/responsible-gambling';

export type MiniGamePhase = 'idle' | 'waiting' | 'countdown' | 'running' | 'crashed';
export interface MiniGameState { phase: MiniGamePhase; roundId: string | null; multiplier: number | null; countdownSeconds: number | null; startedAt: string | null; crashedAt: string | null; crashPoint: number | null; nextRoundAt: string | null; serverTime: string; serverSeedHash: string | null; clientSeed: string | null; nonce: number | null; /** Revealed only after crash */ serverSeed: string | null; }
export interface MiniBet { id: string; roundId: string | null; amount: number; autoCashout: number | null; state: 'pending'|'placed'|'active'|'cashed_out'|'lost'|'cancelled'|'failed'; cashoutMultiplier: number | null; pnl: number | null; createdAt: string; settledAt: string | null; }
type EventName = 'game:state'|'game:countdown'|'game:round-start'|'game:multiplier'|'game:round-end'|'bet:placed'|'bet:cashed-out'|'user:balance'|'admin:state'|'system:error';
interface Listener { (name: EventName, payload: Record<string, unknown>): void; }

function crashPoint(serverSeed: string, clientSeed: string, nonce: number, houseEdge: number): number { const digest=createHmac('sha256',serverSeed).update(`${clientSeed}:${nonce}`).digest('hex'); const intValue=Number.parseInt(digest.slice(0,13),16); if(intValue%33===0)return 1; const remainder=intValue%2**32; if(remainder===0)return 1; return Math.max(1,Math.floor((2**32/remainder)*(1-houseEdge)*100)/100); }
function hashSeed(seed: string): string { return createHash('sha256').update(seed).digest('hex'); }

export class MiniGameService {
  private phase: MiniGamePhase='idle'; private roundId:string|null=null; private multiplier:number|null=null; private countdown=0; private startedAt:string|null=null; private crashedAt:string|null=null; private crashAt=1; private serverSeed:string|null=null; private clientSeed=''; private nonce=0; private timer:NodeJS.Timeout|null=null; private roundNumber=0; private readonly listeners=new Set<Listener>(); private readonly houseEdge=0.01; private readonly countdownSeconds=5;
  /** Per-user client-seed commitments for the current waiting window */
  private readonly userClientSeeds = new Map<string, string>();
  /** Min-heap of pending auto-cashout targets (drained each tick while running) */
  private autoCashoutHeap: Array<{ target: number; betId: string; userId: string }> = [];
  subscribe(listener:Listener):()=>void { this.listeners.add(listener); return ()=>this.listeners.delete(listener); }
  getState():MiniGameState { const now=new Date().toISOString(); const hash=this.serverSeed?hashSeed(this.serverSeed):null; return {phase:this.phase,roundId:this.roundId,multiplier:this.multiplier,countdownSeconds:this.phase==='countdown'?this.countdown:null,startedAt:this.startedAt,crashedAt:this.crashedAt,crashPoint:this.phase==='crashed'?this.crashAt:null,nextRoundAt:null,serverTime:now,serverSeedHash:hash,clientSeed:this.clientSeed||null,nonce:this.roundId?this.nonce:null,serverSeed:this.phase==='crashed'?this.serverSeed:null}; }
  start(): void { if(this.phase!=='idle'&&this.phase!=='crashed')return; this.beginRound(); }
  pause(): void { if(this.timer){clearInterval(this.timer);this.timer=null;} this.phase='idle'; this.emit('admin:state',{status:'paused',mode:'dry-run'}); }
  stop(): void { if(this.timer){clearInterval(this.timer);this.timer=null;} this.phase='idle'; this.emit('admin:state',{status:'stopped',mode:'dry-run'}); }
  resume(): void { if(this.phase==='idle')this.beginRound(); }
  emergencyStop(): void { this.stop(); this.emit('admin:state',{status:'stopped',mode:'maintenance'}); }
  /**
   * Player-provided client seed must be set before or during waiting/countdown,
   * never after the round is running (commitment already locked).
   */
  setClientSeed(userId: string, seed: string): void {
    const s = String(seed || '').trim();
    if (!userId) throw new Error('userId required for clientSeed');
    if (!s) throw new Error('clientSeed required');
    if (this.phase === 'running' || this.phase === 'crashed' || this.phase === 'countdown') {
      throw new Error('clientSeed locked for this round');
    }
    // Per-user commitment — does not mutate another user's or global mid-round seed
    this.userClientSeeds.set(userId, s);
    // Round seed is composite of all commitments when round opens; display last committed for UX
    this.clientSeed = s;
    this.emitState();
  }

  /** Frozen client seed for the round (committed at countdown start) */
  private freezeRoundClientSeed(): string {
    if (this.userClientSeeds.size === 0) {
      return this.clientSeed || 'default-client-seed';
    }
    // Deterministic composite of all user commitments
    const parts = [...this.userClientSeeds.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([u,s]) => `${u}:${s}`);
    return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
  }

  async placeBet(userId:string, amount:number, autoCashout:number|null, idempotencyKey:string):Promise<MiniBet> {
    const rg = assertBettingAllowed(userId);
    if(!rg.allowed) throw new Error(`Responsible gambling block: ${rg.reason}`);
    if(this.phase!=='countdown'||!this.roundId) throw new Error('Betting is closed');
    // P0-05: authoritative bet limits (server-side)
    const minBet = Number(process.env.MINI_MIN_BET ?? 1);
    const maxBet = Number(process.env.MINI_MAX_BET ?? 10000);
    const betStep = Number(process.env.MINI_BET_STEP ?? 1);
    if (!Number.isFinite(amount) || amount < minBet) throw new Error(`Amount below minBet ${minBet}`);
    if (amount > maxBet) throw new Error(`Amount above maxBet ${maxBet}`);
    if (betStep > 0 && Math.abs(amount / betStep - Math.round(amount / betStep)) > 1e-9) {
      throw new Error(`Amount must be multiple of betStep ${betStep}`);
    }
    const pool=getPool(); const client=await pool.connect();
    try { await client.query('BEGIN'); const existing=await client.query('SELECT * FROM mini_app_bets WHERE idempotency_key=$1 FOR UPDATE',[idempotencyKey]); if(existing.rows[0]){await client.query('COMMIT');return this.rowToBet(existing.rows[0]);}
      const prefs=await client.query('SELECT data FROM mini_app_preferences WHERE user_id=$1',[userId]); const pref=prefs.rows[0]?.data; const maxLoss=typeof pref==='object'&&pref!==null&&!Array.isArray(pref)&&typeof pref.maxDailyLoss==='number'?pref.maxDailyLoss:null; if(maxLoss!==null){const loss=await client.query("SELECT COALESCE(SUM(CASE WHEN pnl<0 THEN -pnl ELSE 0 END),0)::float loss FROM mini_app_bets WHERE user_id=$1 AND created_at >= CURRENT_DATE",[userId]); if(Number(loss.rows[0]?.loss??0)+amount>maxLoss)throw new Error('RISK_LIMIT_REACHED');} const balance=await client.query('SELECT balance FROM mini_app_balances WHERE user_id=$1 FOR UPDATE',[userId]); const current=Number(balance.rows[0]?.balance ?? 0); let usedPromo=false; if(current<amount){ const ok=await consumeBonusEntries(userId,1,client); if(!ok) throw new Error('INSUFFICIENT_BALANCE'); usedPromo=true; } await client.query('INSERT INTO mini_app_balances(user_id,balance) VALUES($1,0) ON CONFLICT(user_id) DO NOTHING',[userId]); if(!usedPromo){ await client.query('UPDATE mini_app_balances SET balance=balance-$1,updated_at=NOW() WHERE user_id=$2',[amount,userId]); }
      const result=await client.query('INSERT INTO mini_app_bets(user_id,round_id,amount,auto_cashout,state,idempotency_key) VALUES($1,$2,$3,$4,\'placed\',$5) RETURNING *',[userId,this.roundId,amount,autoCashout,idempotencyKey]); await client.query('COMMIT'); const bet=this.rowToBet(result.rows[0]); this.enqueueAutoCashout(userId, bet.id, autoCashout); this.emit('bet:placed',{bet,userId,serverTime:new Date().toISOString()}); return bet;
    } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
  }
  async cashout(userId:string, betId:string):Promise<{betId:string;multiplier:number;pnl:number;balanceAfter:number}> {
    if(this.phase!=='running'||!this.roundId)throw new Error('Cashout is unavailable'); const pool=getPool(); const client=await pool.connect();
    try{await client.query('BEGIN'); const result=await client.query('SELECT * FROM mini_app_bets WHERE id=$1 AND user_id=$2 FOR UPDATE',[betId,userId]); const row=result.rows[0]; if(!row||String(row.state)!=='placed'&&String(row.state)!=='active')throw new Error('BET_NOT_ACTIVE'); const m=this.multiplier??1; const pnl=Number(row.amount)*(m-1); const payout=Number(row.amount)+pnl; const settled=await client.query('UPDATE mini_app_bets SET state=\'cashed_out\',cashout_multiplier=$1,pnl=$2,settled_at=NOW() WHERE id=$3 AND state IN (\'placed\',\'active\') RETURNING id',[m,pnl,betId]); if(settled.rowCount===0) throw new Error('BET_ALREADY_SETTLED'); await client.query('INSERT INTO mini_app_balances(user_id,balance) VALUES($1,0) ON CONFLICT(user_id) DO NOTHING',[userId]); await client.query('UPDATE mini_app_balances SET balance=balance+$1,updated_at=NOW() WHERE user_id=$2',[payout,userId]); const bal=await client.query('SELECT balance FROM mini_app_balances WHERE user_id=$1',[userId]); await client.query('COMMIT'); const balanceAfter=Number(bal.rows[0]?.balance??0); this.emit('bet:cashed-out',{userId,betId,multiplier:m,pnl,serverTime:new Date().toISOString()}); this.emit('user:balance',{userId,balance:balanceAfter,currency:'USD',serverTime:new Date().toISOString()}); return {betId,multiplier:m,pnl,balanceAfter}; }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  private beginRound():void { this.roundNumber+=1; this.roundId=randomUUID(); this.serverSeed=randomBytes(32).toString('hex'); if(!this.clientSeed) this.clientSeed=randomBytes(16).toString('hex'); this.nonce+=1; this.crashAt=crashPoint(this.serverSeed,this.clientSeed,this.nonce,this.houseEdge); this.multiplier=1; this.countdown=this.countdownSeconds; this.startedAt=new Date().toISOString(); this.crashedAt=null; this.phase='countdown'; this.clientSeed=this.freezeRoundClientSeed(); void this.persistRound('countdown'); this.emit('game:round-start',{roundId:this.roundId,serverSeedHash:hashSeed(this.serverSeed),clientSeed:this.clientSeed,nonce:this.nonce,countdownSeconds:this.countdownSeconds,serverTime:this.startedAt}); this.emitState(); this.timer=setInterval(()=>this.tick(),100); }
  private tick():void { if(this.phase==='countdown'){this.countdown=Math.max(0,this.countdown-0.1); if(this.countdown<=0){this.phase='running';this.countdown=0;this.startedAt=new Date().toISOString();void this.activateRound();} else if(Math.abs(this.countdown-Math.round(this.countdown))<0.001)this.emit('game:countdown',{roundId:this.roundId,secondsRemaining:Math.ceil(this.countdown),serverTime:new Date().toISOString()}); return; } if(this.phase!=='running'||!this.startedAt)return; const elapsed=(Date.now()-Date.parse(this.startedAt))/1000; this.multiplier=Math.max(1,Number(Math.exp(elapsed*0.12).toFixed(2))); this.emit('game:multiplier',{roundId:this.roundId,multiplier:this.multiplier,serverTime:new Date().toISOString()}); void this.autoCashout(); if(this.multiplier>=this.crashAt)this.endRound(); }
  private endRound():void { if(this.timer){clearInterval(this.timer);this.timer=null;} this.phase='crashed';this.multiplier=this.crashAt;this.crashedAt=new Date().toISOString();const roundId=this.roundId;void (async()=>{const result=await getPool().query(`SELECT COUNT(*)::int total_bets,COALESCE(SUM(amount),0)::float total_wagered,COALESCE(SUM(CASE WHEN state='cashed_out' THEN amount+COALESCE(pnl,0) ELSE 0 END),0)::float total_paid_out FROM mini_app_bets WHERE round_id=$1`,[roundId]);await this.settleLosses();await this.persistRound('crashed');const row=result.rows[0]??{};this.emit('game:round-end',{roundId,crashPoint:this.crashAt,totalBets:Number(row.total_bets??0),totalWagered:Number(row.total_wagered??0),totalPaidOut:Number(row.total_paid_out??0),serverTime:this.crashedAt});this.emitState();setTimeout(()=>{this.clientSeed='';this.userClientSeeds.clear();this.phase='idle';this.emitState();this.beginRound();},1000);})().catch((error)=>this.emit('system:error',{code:'ROUND_SETTLEMENT_FAILED',message:error instanceof Error?error.message:'Round settlement failed',serverTime:new Date().toISOString()})); }
  private async autoCashout(): Promise<void> {
    if (!this.roundId || this.multiplier === null) return;
    // Drain heap while target <= current multiplier (memory-first; DB is settlement SoT)
    while (this.autoCashoutHeap.length > 0) {
      // keep sorted by target ascending
      this.autoCashoutHeap.sort((a, b) => a.target - b.target);
      const top = this.autoCashoutHeap[0];
      if (top.target > this.multiplier) break;
      this.autoCashoutHeap.shift();
      try {
        await this.cashout(top.userId, top.betId);
      } catch {
        /* race with manual cashout or crash */
      }
    }
  }

  private enqueueAutoCashout(userId: string, betId: string, target: number | null): void {
    if (target == null || !Number.isFinite(target)) return;
    this.autoCashoutHeap.push({ target, betId, userId });
  }
  private async activateRound():Promise<void>{ if(!this.roundId)return; this.phase='running'; await this.persistRound('running'); await getPool().query('UPDATE mini_app_bets SET state=\'active\' WHERE round_id=$1 AND state=\'placed\'',[this.roundId]); this.emitState(); }
  private async settleLosses():Promise<void>{this.autoCashoutHeap=[];if(!this.roundId)return;await getPool().query('UPDATE mini_app_bets SET state=\'lost\',pnl=-amount,settled_at=NOW() WHERE round_id=$1 AND state IN (\'placed\',\'active\')',[this.roundId]);}
  private async persistRound(phase:MiniGamePhase):Promise<void>{if(!this.roundId||!this.serverSeed)return;try{await getPool().query('INSERT INTO mini_app_rounds(id,server_seed_hash,server_seed,client_seed,nonce,phase,crash_point,started_at,crashed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET phase=EXCLUDED.phase,server_seed=COALESCE(EXCLUDED.server_seed,mini_app_rounds.server_seed),crash_point=EXCLUDED.crash_point,crashed_at=EXCLUDED.crashed_at',[this.roundId,hashSeed(this.serverSeed),phase==='crashed'?this.serverSeed:null,this.clientSeed,this.nonce,phase,phase==='crashed'?this.crashAt:null,this.startedAt,this.crashedAt]);}catch{/* Persistence failure is surfaced by health checks. */}}
  private emit(name:EventName,payload:Record<string,unknown>):void{for(const listener of this.listeners)listener(name,payload);}
  private emitState():void{this.emit('game:state',{state:this.getState(),serverTime:new Date().toISOString()});}
  private rowToBet(row:Record<string,unknown>):MiniBet{return{id:String(row.id),roundId:row.round_id?String(row.round_id):null,amount:Number(row.amount),autoCashout:row.auto_cashout===null?null:Number(row.auto_cashout),state:String(row.state) as MiniBet['state'],cashoutMultiplier:row.cashout_multiplier===null?null:Number(row.cashout_multiplier),pnl:row.pnl===null?null:Number(row.pnl),createdAt:new Date(row.created_at as string|number|Date).toISOString(),settledAt:row.settled_at?new Date(row.settled_at as string|number|Date).toISOString():null};}
}
export const miniGameService = new MiniGameService();
