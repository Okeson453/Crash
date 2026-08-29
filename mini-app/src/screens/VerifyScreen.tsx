import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getRoundFairness } from '@/api/game';
import { verifyCrashPoint, verifyServerSeedHash } from '@/utils/fairness';
import { formatMultiplier } from '@/utils/formatting';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Shield, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

export function VerifyScreen() {
  const { roundId } = useParams<{ roundId: string }>();
  const navigate = useNavigate();
  const [verification, setVerification] = useState<{
    valid: boolean;
    calculatedCrashPoint: number;
    hashValid: boolean;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: fairness, isLoading } = useQuery({
    queryKey: ['fairness', roundId],
    queryFn: () => getRoundFairness(roundId!),
    enabled: !!roundId,
  });

  const handleVerify = async () => {
    if (!fairness?.serverSeed || !fairness?.clientSeed) return;

    setIsVerifying(true);
    try {
      const [result, hashValid] = await Promise.all([
        verifyCrashPoint(
          fairness.serverSeed,
          fairness.clientSeed,
          fairness.nonce,
          0 // We don't know the expected crash point here, just verify the calculation
        ),
        verifyServerSeedHash(fairness.serverSeed, fairness.serverSeedHash),
      ]);

      setVerification({
        valid: result.valid,
        calculatedCrashPoint: result.calculatedCrashPoint,
        hashValid,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!fairness) {
    return (
      <EmptyState
        icon={Shield}
        title="Round not found"
        description="The fairness data for this round is unavailable."
        action={{ label: 'Go Back', onClick: () => navigate(-1) }}
      />
    );
  }

  return (
    <div className="page-container px-4 py-4 space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-tg-link mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-tg-link" />
          <div>
            <h2 className="text-lg font-bold text-tg-text">Fairness Verification</h2>
            <p className="text-xs text-tg-hint">Round #{roundId?.slice(-6)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <DataRow label="Server Seed Hash" value={fairness.serverSeedHash} />
          {fairness.serverSeed && (
            <DataRow label="Server Seed" value={fairness.serverSeed} />
          )}
          <DataRow label="Client Seed" value={fairness.clientSeed} />
          <DataRow label="Nonce" value={String(fairness.nonce)} />
        </div>

        {!fairness.serverSeed && (
          <div className="mt-4 p-3 bg-crash-yellow/10 rounded-lg">
            <p className="text-xs text-crash-yellow">
              The server seed will be revealed after the round completes.
            </p>
          </div>
        )}

        {fairness.serverSeed && (
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="w-full btn-primary mt-4"
          >
            {isVerifying ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner size="sm" />
                Verifying...
              </span>
            ) : (
              'Verify Fairness'
            )}
          </button>
        )}

        {verification && (
          <div className="mt-4 space-y-3">
            <ResultRow
              label="Server Seed Hash"
              valid={verification.hashValid}
              message={
                verification.hashValid
                  ? 'Hash matches the revealed seed'
                  : 'Hash does not match!'
              }
            />
            <ResultRow
              label="Crash Point Calculation"
              valid={verification.valid}
              message={`Calculated: ${formatMultiplier(verification.calculatedCrashPoint)}`}
            />
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="section-header">How It Works</h3>
        <ol className="space-y-2 text-sm text-tg-text list-decimal list-inside">
          <li>Before each round, we generate a server seed and show you its hash.</li>
          <li>You provide a client seed (or we generate one for you).</li>
          <li>After the round, we reveal the server seed.</li>
          <li>You can verify that the hash matches and the crash point was calculated fairly.</li>
        </ol>
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-tg-hint">{label}</span>
      <code className="text-xs font-mono bg-tg-section px-2 py-1 rounded break-all text-tg-text">
        {value}
      </code>
    </div>
  );
}

function ResultRow({
  label,
  valid,
  message,
}: {
  label: string;
  valid: boolean;
  message: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg ${
        valid ? 'bg-crash-green/10' : 'bg-crash-red/10'
      }`}
    >
      {valid ? (
        <CheckCircle className="w-5 h-5 text-crash-green flex-shrink-0" />
      ) : (
        <XCircle className="w-5 h-5 text-crash-red flex-shrink-0" />
      )}
      <div>
        <p className="text-sm font-medium text-tg-text">{label}</p>
        <p className={`text-xs ${valid ? 'text-crash-green' : 'text-crash-red'}`}>
          {message}
        </p>
      </div>
    </div>
  );
}
