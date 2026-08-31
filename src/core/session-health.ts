export interface SessionHealthSnapshot {
  authenticated: boolean;
  phase: string;
  lastSuccessfulObservationAt: string | null;
  consecutiveFailures: number;
  lastError: { message: string; at: string } | null;
  browserLaunched: boolean;
  uptimeSeconds: number;
}

export class SessionHealthTracker {
  private consecutiveFailures = 0;
  private lastSuccessAt: string | null = null;
  private lastError: { message: string; at: string } | null = null;
  private readonly startedAt = Date.now();

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.lastSuccessAt = new Date().toISOString();
  }

  recordFailure(message: string): void {
    this.consecutiveFailures += 1;
    this.lastError = { message, at: new Date().toISOString() };
  }

  snapshot(
    authenticated: boolean,
    phase: string,
    browserLaunched: boolean
  ): SessionHealthSnapshot {
    return {
      authenticated,
      phase,
      lastSuccessfulObservationAt: this.lastSuccessAt,
      consecutiveFailures: this.consecutiveFailures,
      lastError: this.lastError,
      browserLaunched,
      uptimeSeconds: (Date.now() - this.startedAt) / 1000,
    };
  }
}
