/**
 * Per-tenant prediction container (issue 8) — avoids sharing ensemble/calibration across orgs.
 */
import { EnsembleOrchestrator } from '../prediction/ensemble/ensemble-orchestrator.js';
import { CalibrationState } from '../prediction/calibration/calibration-state.js';

const tenantContainers = new Map<
  string,
  { ensemble: EnsembleOrchestrator; calibration: CalibrationState }
>();

export function getTenantContainer(tenantId: string) {
  let c = tenantContainers.get(tenantId);
  if (!c) {
    c = {
      ensemble: new EnsembleOrchestrator(),
      calibration: new CalibrationState(),
    };
    tenantContainers.set(tenantId, c);
  }
  return c;
}

export function clearTenantContainers(): void {
  tenantContainers.clear();
}
