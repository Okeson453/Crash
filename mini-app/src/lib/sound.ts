import { useSettingsStore } from '@/stores/settingsStore';
import { logger } from '@/utils/logger';
const SOUNDS={ 'bet-placed':'/sounds/bet-placed.mp3', cashout:'/sounds/cashout.mp3', crash:'/sounds/crash.mp3', 'win-jingle':'/sounds/win-jingle.mp3', 'round-start':'/sounds/round-start.mp3', 'countdown-tick':'/sounds/countdown-tick.mp3', error:'/sounds/error.mp3' } as const;
export type SoundName=keyof typeof SOUNDS;
const cache:Partial<Record<SoundName,HTMLAudioElement>>={};
export function playSound(name:SoundName):void{if(!useSettingsStore.getState().soundEnabled)return;let audio=cache[name];if(!audio){audio=new Audio(SOUNDS[name]);audio.preload='auto';cache[name]=audio;}audio.currentTime=0;void audio.play().catch((error:unknown)=>logger.warn('Sound playback failed',{name,error}));}
