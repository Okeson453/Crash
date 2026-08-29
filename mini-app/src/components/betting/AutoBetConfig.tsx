import { useSettingsStore } from '@/stores/settingsStore';
import { updateUserPreferences } from '@/api/users';
import { useMutation } from '@tanstack/react-query';
import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import type { UserPreferences } from '@/types/api';

type AutoBetConfigValue = NonNullable<UserPreferences['autoBet']>;

const DEFAULT_AUTO_BET: AutoBetConfigValue = {
  enabled: false,
  strategy: 'repeat-last',
  maxBet: 100,
  stopAfterRounds: null,
};

export function AutoBetConfig() {
  const autoBet = useSettingsStore((s) => s.autoBet);
  const update = useSettingsStore((s) => s.updateSettings);
  const mutation = useMutation({ mutationFn: updateUserPreferences });

  const current: AutoBetConfigValue = {
    ...DEFAULT_AUTO_BET,
    ...(autoBet ?? {}),
  };

  const save = (partial: Partial<AutoBetConfigValue>) => {
    const value: AutoBetConfigValue = { ...current, ...partial };
    update({ autoBet: value });
    mutation.mutate({ autoBet: value });
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-tg-text">Auto-bet</span>
        <Switch
          checked={current.enabled}
          onChange={(enabled) => save({ enabled })}
          label="Enable auto-bet"
        />
      </div>
      <Select
        aria-label="Auto-bet strategy"
        value={current.strategy}
        onChange={(e) => {
          const value = e.target.value;
          if (
            value === 'repeat-last' ||
            value === 'custom-sequence' ||
            value === 'martingale' ||
            value === 'anti-martingale' ||
            value === 'fibonacci'
          ) {
            save({ strategy: value });
          }
        }}
      >
        <option value="repeat-last">Repeat last</option>
        <option value="custom-sequence">Custom sequence</option>
        <option value="martingale">Martingale</option>
        <option value="anti-martingale">Anti-martingale</option>
        <option value="fibonacci">Fibonacci</option>
      </Select>
      <Input
        aria-label="Maximum auto-bet"
        type="number"
        value={current.maxBet}
        onChange={(e) => save({ maxBet: Number(e.target.value) })}
      />
    </div>
  );
}
