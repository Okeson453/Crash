interface SkeletonProps { className?: string; }
export function Skeleton({ className = '' }: SkeletonProps) { return <div className={`animate-pulse rounded-lg bg-tg-hint/20 ${className}`} aria-hidden="true" />; }
export function SkeletonCard() { return <div className="card space-y-3"><Skeleton className="h-4 w-1/3"/><Skeleton className="h-8 w-2/3"/><Skeleton className="h-4 w-1/2"/></div>; }
export function SkeletonList({ count = 5 }: { count?: number }) { return <div className="space-y-3">{Array.from({length:count},(_,index)=><SkeletonCard key={index}/>)}</div>; }
export function ScreenSkeleton() { return <div className="space-y-4 p-4" aria-busy="true"><Skeleton className="h-10 w-full"/><SkeletonCard/><SkeletonCard/><Skeleton className="h-32 w-full"/></div>; }
export function CardSkeleton() { return <SkeletonCard/>; }
export function ChartSkeleton() { return <Skeleton className="h-48 w-full"/>; }
export function TableSkeleton() { return <div className="space-y-2">{Array.from({length:6},(_,index)=><Skeleton key={index} className="h-10 w-full"/>)}</div>; }
export function GameSkeleton() { return <div className="space-y-4"><Skeleton className="h-8 w-1/2 mx-auto"/><Skeleton className="h-48 w-full"/><SkeletonCard/></div>; }
export function ProfileSkeleton() { return <div className="card flex gap-4"><Skeleton className="h-14 w-14 rounded-full"/><Skeleton className="h-8 flex-1"/></div>; }
