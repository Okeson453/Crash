import { logger } from '@/utils/logger';
export function reportWebVitals(): void {
  if (!('PerformanceObserver' in window)) return;
  try { new PerformanceObserver((list) => { const entries=list.getEntries(); const last=entries[entries.length-1]; if(last) logger.info('LCP observed',{value:last.startTime}); }).observe({type:'largest-contentful-paint',buffered:true}); } catch { /* unsupported */ }
  try { new PerformanceObserver((list) => { const value=list.getEntries().reduce((total,entry)=>total+entry.duration,0); logger.info('Layout shift observed',{value}); }).observe({type:'layout-shift',buffered:true}); } catch { /* unsupported */ }
  try { new PerformanceObserver((list) => { const entries=list.getEntries(); const last=entries[entries.length-1]; if(last) logger.info('Interaction observed',{value:last.duration}); }).observe({type:'event',buffered:true,durationThreshold:40}); } catch { /* unsupported */ }
  const navigation=performance.getEntriesByType('navigation')[0]; if(navigation && 'responseStart' in navigation && typeof navigation.responseStart === 'number') logger.info('TTFB observed',{value:navigation.responseStart-navigation.startTime});
}
