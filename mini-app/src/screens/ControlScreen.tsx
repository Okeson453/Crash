import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminSessionState, getAdminConfig, updateAdminConfig } from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { ConfigForm } from '@/components/admin/ConfigForm';
import { SessionControlPanel } from '@/components/admin/SessionControlPanel';
import { HealthChecks } from '@/components/admin/HealthChecks';
import { Card } from '@/components/ui/Card';
import type { AdminConfig } from '@/types/api';
export function ControlScreen(){const qc=useQueryClient();const [showConfig,setShowConfig]=useState(false);const session=useQuery({queryKey:['admin-session'],queryFn:getAdminSessionState,refetchInterval:5000});const config=useQuery({queryKey:['admin-config'],queryFn:getAdminConfig});const mutation=useMutation({mutationFn:updateAdminConfig,onSuccess:()=>void qc.invalidateQueries({queryKey:['admin-config']})});if(session.isLoading)return <div className="flex min-h-screen items-center justify-center"><LoadingSpinner size="lg"/></div>;return <div className="page-container space-y-4 px-4 py-4"><SessionControlPanel/><HealthChecks checks={session.data?.healthChecks??[]}/><Card><button className="min-h-11 w-full text-left font-semibold text-tg-text" onClick={()=>setShowConfig(!showConfig)}>Configuration</button>{showConfig&&config.data&&<ConfigForm config={config.data} onSubmit={(data:AdminConfig)=>mutation.mutate(data)} isLoading={mutation.isPending}/>}</Card></div>;}
