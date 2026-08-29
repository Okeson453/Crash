import { SkeletonCard } from '@/components/ui/Skeleton';
export function HistorySkeleton() { return <div className="space-y-3">{[1,2,3,4,5].map((id) => <SkeletonCard key={id} />)}</div>; }
