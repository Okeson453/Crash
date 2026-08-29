import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getPlans } from '@/api/plans';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/utils/formatting';
import { Check, Crown, Zap, Star, ArrowLeft } from 'lucide-react';

const PLAN_ICONS: Record<string, typeof Zap> = {
  Free: Zap,
  Starter: Star,
  Pro: Crown,
};

const PLAN_COLORS: Record<string, string> = {
  Free: 'bg-tg-section text-tg-text',
  Starter: 'bg-tg-button text-tg-button-text',
  Pro: 'bg-crash-purple text-white',
};

export function PricingScreen() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const addToast = useUIStore((s) => s.addToast);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: getPlans,
    staleTime: Infinity,
  });

  const currentPlanId = user?.planId;

  const handleSelectPlan = (planId: string) => {
    if (planId === currentPlanId) {
      addToast({ type: 'info', message: 'You are already on this plan' });
      return;
    }
    addToast({ type: 'info', message: 'Plan upgrade coming soon!' });
  };

  return (
    <div className="page-container px-4 py-4 space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-tg-link mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-tg-text mb-2">Choose Your Plan</h1>
        <p className="text-sm text-tg-hint max-w-xs mx-auto">
          Upgrade your experience with premium features and higher limits
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : !plans || plans.length === 0 ? (
        <EmptyState
          title="No plans available"
          description="Check back later for subscription options."
        />
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const Icon = PLAN_ICONS[plan.name] || Star;
            const isCurrent = plan.id === currentPlanId;
            const colorClass = PLAN_COLORS[plan.name] || PLAN_COLORS.Free;

            return (
              <div
                key={plan.id}
                className={`card relative ${isCurrent ? 'ring-2 ring-tg-link' : ''}`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-crash-yellow text-black text-xs font-bold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-tg-text">{plan.name}</h3>
                    <p className="text-sm text-tg-hint">
                      {formatCurrency(plan.priceMonthly)}/mo or{' '}
                      {formatCurrency(plan.priceYearly)}/yr
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <FeatureRow label={`${plan.maxDailyEntries} daily entries`} />
                  <FeatureRow label={`${formatCurrency(plan.fixedStake)} fixed stake`} />
                  <FeatureRow label={`${plan.fixedTarget}x cashout target`} />
                  {plan.features.map((feature, idx) => (
                    <FeatureRow key={idx} label={feature} />
                  ))}
                </div>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isCurrent}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                    isCurrent
                      ? 'bg-tg-section text-tg-hint cursor-default'
                      : `${colorClass} active:scale-[0.98]`
                  }`}
                >
                  {isCurrent ? 'Current Plan' : 'Select Plan'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FeatureRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Check className="w-4 h-4 text-crash-green flex-shrink-0" />
      <span className="text-sm text-tg-text">{label}</span>
    </div>
  );
}
