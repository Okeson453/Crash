import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { emergencyStop, pauseGameSession, resumeGameSession } from '@/api/admin';
import { useUIStore } from '@/stores/uiStore';
import { AlertTriangle, Pause, Play, Settings } from 'lucide-react';

export function QuickActions() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);

  const emergency = useMutation({
    mutationFn: emergencyStop,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-session'] });
      addToast({ type: 'error', message: 'Emergency stop executed.' });
      setShowEmergencyConfirm(false);
    },
  });

  const pause = useMutation({
    mutationFn: pauseGameSession,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-session'] });
      addToast({ type: 'warning', message: 'Session paused.' });
    },
  });

  const resume = useMutation({
    mutationFn: resumeGameSession,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-session'] });
      addToast({ type: 'success', message: 'Session resumed.' });
    },
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="destructive" onClick={() => setShowEmergencyConfirm(true)}>
          <AlertTriangle className="mr-2 h-4 w-4" /> Emergency
        </Button>
        <Button variant="secondary" onClick={() => pause.mutate()} loading={pause.isPending}>
          <Pause className="mr-2 h-4 w-4" /> Pause
        </Button>
        <Button onClick={() => resume.mutate()} loading={resume.isPending}>
          <Play className="mr-2 h-4 w-4" /> Resume
        </Button>
        <Button variant="secondary" disabled>
          <Settings className="mr-2 h-4 w-4" /> Config
        </Button>
      </div>
      <Dialog
        open={showEmergencyConfirm}
        title="Emergency Stop"
        message="This will immediately end the current round and prevent new bets. All active bets may be affected. This action is irreversible."
        confirmLabel="Confirm Emergency Stop"
        onConfirm={() => emergency.mutate()}
        onCancel={() => setShowEmergencyConfirm(false)}
      />
    </>
  );
}
