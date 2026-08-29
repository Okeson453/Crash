/**
 * Lightweight in-process mock BC.Game server for simulation tests.
 * (Standalone mock package under local/ is optional and not required for typecheck.)
 */
import { writeFileSync } from 'fs';

export interface SimulationRound {
  id: string;
  crashPoint: number;
  durationMs: number;
  tickIntervalMs: number;
  seed: string;
}

export interface SimulationConfig {
  port?: number;
  rounds?: SimulationRound[];
  autoStart?: boolean;
}

/** Minimal stand-in when local/mock-bc-game-server is not present in the repo. */
class MockBCGameServer {
  private roundCount = 0;
  private currentRound: SimulationRound | null = null;
  private readonly rounds: SimulationRound[];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: { port: number; fixturesPath: string; wsEnabled: boolean; rounds?: SimulationRound[] }) {
    this.rounds = opts.rounds ?? [];
    void opts.port;
    void opts.fixturesPath;
    void opts.wsEnabled;
  }

  start(): void {
    if (this.timer) return;
    let idx = 0;
    this.timer = setInterval(() => {
      if (idx >= this.rounds.length) {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        return;
      }
      this.currentRound = this.rounds[idx++];
      this.roundCount += 1;
    }, 50);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getCurrentRound(): SimulationRound | null {
    return this.currentRound;
  }

  getRoundCount(): number {
    return this.roundCount;
  }
}

export class SimulationServer {
  private server: MockBCGameServer;
  private config: Required<SimulationConfig>;
  private started = false;

  constructor(config: SimulationConfig = {}) {
    this.config = {
      port: 3457,
      rounds: [
        { id: 'sim-round-001', crashPoint: 2.34, durationMs: 2340, tickIntervalMs: 50, seed: 'sim-seed-001' },
        { id: 'sim-round-002', crashPoint: 1.05, durationMs: 50, tickIntervalMs: 50, seed: 'sim-seed-002' },
        { id: 'sim-round-003', crashPoint: 5.67, durationMs: 5670, tickIntervalMs: 50, seed: 'sim-seed-003' },
      ],
      autoStart: true,
      ...config,
    };

    const fixturesPath = '/tmp/sim-fixtures.json';
    writeFileSync(fixturesPath, JSON.stringify(this.config.rounds, null, 2));

    this.server = new MockBCGameServer({
      port: this.config.port,
      fixturesPath,
      wsEnabled: true,
      rounds: this.config.rounds,
    });
  }

  start(): void {
    if (this.started) return;
    this.server.start();
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    this.server.stop();
    this.started = false;
  }

  getUrl(): string {
    return `http://localhost:${this.config.port}`;
  }

  getWsUrl(): string {
    return `ws://localhost:${this.config.port + 1}`;
  }

  getCurrentRound() {
    return this.server.getCurrentRound();
  }

  getRoundCount(): number {
    return this.server.getRoundCount();
  }

  isStarted(): boolean {
    return this.started;
  }

  waitForRounds(count: number, timeoutMs: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        if (this.server.getRoundCount() >= count) {
          resolve();
          return;
        }
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Timeout waiting for ${count} rounds`));
          return;
        }
        setTimeout(check, 100);
      };
      check();
    });
  }
}
