import { api } from './client';
import type { Bet, PlaceBetRequest, CashoutResponse, PaginatedResponse } from '@/types/api';
import type { BetFilters, BetStatus } from '@/types/bet';
export async function placeBet(request: PlaceBetRequest, idempotencyKey: string): Promise<Bet> { return api.post<Bet>('/api/v1/bets', request, { headers: { 'X-Idempotency-Key': idempotencyKey } }); }
export async function cashoutBet(betId: string): Promise<CashoutResponse> { return api.post<CashoutResponse>(`/api/v1/bets/${betId}/cashout`); }
export async function getBets(filters?: BetFilters, cursor?: string): Promise<PaginatedResponse<Bet>> { const params=new URLSearchParams(); if(cursor)params.set('cursor',cursor); if(filters?.status){const statuses=Array.isArray(filters.status)?filters.status:[filters.status];statuses.forEach((status:BetStatus)=>params.append('status',status));} if(filters?.fromDate)params.set('fromDate',filters.fromDate); if(filters?.toDate)params.set('toDate',filters.toDate); if(filters?.minAmount!==undefined)params.set('minAmount',String(filters.minAmount)); if(filters?.maxAmount!==undefined)params.set('maxAmount',String(filters.maxAmount)); return api.get<PaginatedResponse<Bet>>(`/api/v1/bets?${params.toString()}`); }
export async function getBetById(betId:string):Promise<Bet>{return api.get<Bet>(`/api/v1/bets/${betId}`);}
