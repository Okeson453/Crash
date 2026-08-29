import { useState } from 'react';
import { BetPanel } from './BetPanel';
import { Button } from '@/components/ui/Button';
export function TwoBetPanel(){const [showSecond,setShowSecond]=useState(false);const [leftAmount,setLeftAmount]=useState<string>();const [rightAmount,setRightAmount]=useState<string>();return <div className="space-y-3"><BetPanel index={0} onAmountChange={setLeftAmount}/>{showSecond?<><div className="border-t border-tg-hint/10 pt-3"><BetPanel index={1} amountOverride={rightAmount} onAmountChange={setRightAmount}/><Button variant="secondary" className="mt-2 w-full" onClick={()=>setRightAmount(leftAmount)}>Same amount</Button></div></>:<Button variant="secondary" className="w-full" onClick={()=>setShowSecond(true)}>Add second bet</Button>}</div>;}
