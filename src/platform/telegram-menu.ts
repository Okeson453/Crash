/**
 * Tenant / Operator / Admin Telegram menus — 3-column icon grid.
 *
 * Visual format mirrors Telegram's attachment/menu picker:
 *   [ 👤 Label ] [ ⭐ Label ] [ 🤖 Label ]
 *   [ 👥 Label ] [ 📢 Label ] [ 💬 Label ]
 *
 * Bot API constraint: inline buttons are text + emoji only (no custom icons).
 * Layout uses 3 equal cells per row for a dense, responsive grid.
 */

import type { Plan, Tenant, TenantInstance } from './types';

export type MenuRole = 'tenant' | 'operator' | 'admin';

export interface MenuEntitlements {
  canLogin: boolean;
  canControlEngine: boolean;
  canViewAnalytics: boolean;
  canConfigureStake: boolean;
  canSubscribe: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  engineRunning: boolean;
  bcGameConnected: boolean;
  tenantStatus: string;
  role: MenuRole;
}

export function entitlementsFrom(
  tenant: Tenant | null | undefined,
  plan: Plan | null | undefined,
  instance: TenantInstance | null | undefined,
  isAdmin = false,
  opts?: { bcGameConnected?: boolean; isOperator?: boolean }
): MenuEntitlements {
  const features = plan?.features ?? {};
  const status = tenant?.status ?? 'onboarding';
  const active = status === 'active' || status === 'onboarding';
  const engineRunning =
    instance?.status === 'running' || instance?.status === 'paused';
  const isOperator = opts?.isOperator === true;

  let role: MenuRole = 'tenant';
  if (isAdmin) role = 'admin';
  else if (isOperator) role = 'operator';

  return {
    canLogin: active || isAdmin || isOperator,
    canControlEngine: (active && features.engine !== false) || isAdmin || isOperator,
    canViewAnalytics: (active && features.analytics !== false) || isAdmin || isOperator,
    canConfigureStake: (active && plan?.stakeConfigurable !== false) || isAdmin,
    canSubscribe: true,
    isAdmin,
    isOperator,
    engineRunning,
    bcGameConnected: opts?.bcGameConnected ?? false,
    tenantStatus: status,
    role,
  };
}

export function operatorEntitlements(opts?: {
  engineRunning?: boolean;
  bcGameConnected?: boolean;
  isAdmin?: boolean;
}): MenuEntitlements {
  return {
    canLogin: true,
    canControlEngine: true,
    canViewAnalytics: true,
    canConfigureStake: false,
    canSubscribe: false,
    isAdmin: opts?.isAdmin === true,
    isOperator: true,
    engineRunning: opts?.engineRunning === true,
    bcGameConnected: opts?.bcGameConnected === true,
    tenantStatus: 'active',
    role: opts?.isAdmin ? 'admin' : 'operator',
  };
}

export function buildBotCommands(
  ent: MenuEntitlements
): Array<{ command: string; description: string }> {
  const cmds: Array<{ command: string; description: string }> = [
    { command: 'start', description: 'Open CrashWave home' },
    { command: 'menu', description: 'Show control panel' },
    { command: 'help', description: 'Help & command list' },
    { command: 'status', description: 'Status dashboard' },
  ];

  if (ent.canLogin) {
    cmds.push(
      { command: 'login', description: 'Connect BC.Game (secure)' },
      { command: 'logout', description: 'Clear local login session state' }
    );
  }
  if (ent.canControlEngine) {
    cmds.push(
      { command: 'startengine', description: 'Start / resume engine' },
      { command: 'pause', description: 'Pause engine' },
      { command: 'resume', description: 'Resume engine' },
      { command: 'stop', description: 'Stop engine' },
      { command: 'mode', description: 'View or set operating mode' }
    );
  }
  if (ent.canViewAnalytics) {
    cmds.push(
      { command: 'balance', description: 'Balance snapshot' },
      { command: 'pnl', description: 'P&L summary' },
      { command: 'daily', description: 'Daily summary' },
      { command: 'entries', description: 'Entry stats' },
      { command: 'analytics', description: 'Analytics overview' }
    );
  }
  cmds.push(
    { command: 'session', description: 'Session info' },
    { command: 'health', description: 'Health checks' }
  );
  if (ent.canSubscribe) {
    cmds.push({ command: 'subscribe', description: 'Plans & billing' });
  }
  if (ent.canConfigureStake) {
    cmds.push({ command: 'stake', description: 'Stake configuration' });
  }
  if (ent.isAdmin) {
    cmds.push(
      { command: 'admin_users', description: 'List tenants' },
      { command: 'admin_pause_all', description: 'Pause all engines' },
      { command: 'admin_resume_all', description: 'Resume all engines' },
      { command: 'admin_menu', description: 'Admin control panel' }
    );
  }
  return cmds;
}

export type InlineBtn = { text: string; callback_data: string };

/** Icon + short label cell (matches attachment-menu style) */
function cell(emoji: string, label: string, data: string): InlineBtn {
  return { text: `${emoji} ${label}`, callback_data: data };
}

/**
 * Permanent bottom keyboard (always visible above the chat input).
 * Telegram ReplyKeyboard — stays until removed; no need to re-open /menu.
 */
export type ReplyBtn = { text: string };

export function persistentReplyKeyboard(ent: MenuEntitlements): {
  keyboard: ReplyBtn[][];
  resize_keyboard: true;
  is_persistent: true;
  input_field_placeholder: string;
} {
  const row = (...labels: string[]): ReplyBtn[] => labels.map((text) => ({ text }));
  const rows: ReplyBtn[][] = [];

  if (ent.canLogin) {
    rows.push(row(ent.bcGameConnected ? '✅ BC.Game' : '🔐 Login', '📊 Status', '🏠 Menu'));
  } else {
    rows.push(row('📊 Status', '🏠 Menu', '❓ Help'));
  }

  if (ent.canControlEngine) {
    if (ent.engineRunning) {
      rows.push(row('⏸ Pause', '🔄 Resume', '⛔ Stop'));
    } else {
      rows.push(row('▶️ Start', '🛠 Mode', '❤️ Health'));
    }
  }

  if (ent.canViewAnalytics) {
    rows.push(row('💰 Balance', '📈 P&L', '🎯 Analytics'));
  }

  const settingsRow: string[] = ['⚙️ Settings'];
  if (ent.isAdmin) settingsRow.push('🛡 Admin');
  settingsRow.push('❓ Help');
  rows.push(row(...settingsRow));

  return {
    keyboard: rows,
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: 'Tap a button or type a command',
  };
}

/** Map permanent-keyboard button text → ui action id */
export function replyKeyboardAction(text: string): string | null {
  const t = text.trim();
  // Exact map (covers current keyboard labels + common emoji variants users may still have)
  const map: Record<string, string> = {
    '🔐 Login': 'login',
    '🔒 Login': 'login',
    '🔐 BC.Game': 'login',
    '🔒 BC.Game': 'login',
    '✅ BC.Game': 'login',
    '✅ Login': 'login',
    'Login': 'login',
    '📊 Status': 'status',
    'Status': 'status',
    '🏠 Menu': 'menu',
    'Menu': 'menu',
    '❓ Help': 'help',
    'Help': 'help',
    '⏸ Pause': 'pause',
    'Pause': 'pause',
    '🔄 Resume': 'resume',
    'Resume': 'resume',
    '⛔ Stop': 'stop',
    'Stop': 'stop',
    '▶️ Start': 'startengine',
    'Start': 'startengine',
    '🛠 Mode': 'mode',
    'Mode': 'mode',
    '❤️ Health': 'health',
    'Health': 'health',
    '💰 Balance': 'balance',
    'Balance': 'balance',
    '📈 P&L': 'pnl',
    'P&L': 'pnl',
    '🎯 Analytics': 'analytics',
    'Analytics': 'analytics',
    '⚙️ Settings': 'settings',
    'Settings': 'settings',
    '🛡 Admin': 'admin_menu',
    'Admin': 'admin_menu',
  };
  if (map[t]) return map[t];
  // Fuzzy: any button whose text ends with Login / contains BC.Game login intent
  const lower = t.toLowerCase();
  if (/login/i.test(t) && !lower.startsWith('/')) return 'login';
  if (/^status$/i.test(t) || /📊/.test(t)) return 'status';
  if (/^menu$/i.test(t) || /🏠/.test(t)) return 'menu';
  return null;
}

/** Pad incomplete rows so the grid stays aligned (Telegram stretches uneven rows) */
function grid3(cells: InlineBtn[]): InlineBtn[][] {
  const rows: InlineBtn[][] = [];
  for (let i = 0; i < cells.length; i += 3) {
    const chunk = cells.slice(i, i + 3);
    while (chunk.length < 3 && cells.length > 3) {
      break;
    }
    rows.push(chunk);
  }
  return rows;
}

export function roleControlKeyboard(ent: MenuEntitlements): InlineBtn[][] {
  if (ent.role === 'admin') return adminControlKeyboard(ent);
  if (ent.role === 'operator') return operatorControlKeyboard(ent);
  return mainControlKeyboard(ent);
}

export function mainControlKeyboard(ent: MenuEntitlements): InlineBtn[][] {
  const cells: InlineBtn[] = [];
  if (ent.canLogin) {
    cells.push(
      cell(
        ent.bcGameConnected ? '✅' : '🔐',
        ent.bcGameConnected ? 'BC.Game' : 'Login',
        'ui:login'
      )
    );
  }
  cells.push(cell('📊', 'Status', 'ui:status'));
  if (ent.canControlEngine) {
    if (ent.engineRunning) {
      cells.push(cell('⏸', 'Pause', 'ui:pause'));
      cells.push(cell('🔄', 'Resume', 'ui:resume'));
      cells.push(cell('⛔', 'Stop', 'ui:stop'));
    } else {
      cells.push(cell('▶️', 'Start', 'ui:startengine'));
    }
    cells.push(cell('🛠', 'Mode', 'ui:mode'));
  }
  if (ent.canViewAnalytics) {
    cells.push(cell('💰', 'Balance', 'ui:balance'));
    cells.push(cell('📈', 'P&L', 'ui:pnl'));
    cells.push(cell('🎯', 'Analytics', 'ui:analytics'));
    cells.push(cell('📋', 'Entries', 'ui:entries'));
  }
  cells.push(cell('🖥', 'Session', 'ui:session'));
  cells.push(cell('❤️', 'Health', 'ui:health'));
  cells.push(cell('⚙️', 'Settings', 'ui:settings'));
  cells.push(cell('❓', 'Help', 'ui:help'));
  cells.push(cell('🏠', 'Menu', 'ui:menu'));
  return grid3(cells);
}

export function operatorControlKeyboard(ent: MenuEntitlements): InlineBtn[][] {
  const cells: InlineBtn[] = [
    cell(
      ent.bcGameConnected ? '✅' : '🔐',
      ent.bcGameConnected ? 'BC.Game' : 'Login',
      'ui:login'
    ),
    cell('📊', 'Status', 'ui:status'),
  ];
  if (ent.engineRunning) {
    cells.push(cell('⏸', 'Pause', 'ui:pause'));
    cells.push(cell('🔄', 'Resume', 'ui:resume'));
    cells.push(cell('⛔', 'Stop', 'ui:stop'));
  } else {
    cells.push(cell('▶️', 'Start', 'ui:startengine'));
  }
  cells.push(cell('🛡', 'Sheath', 'ui:sheath'));
  cells.push(cell('❤️', 'Health', 'ui:health'));
  cells.push(cell('🖥', 'Session', 'ui:session'));
  cells.push(cell('💰', 'Balance', 'ui:balance'));
  cells.push(cell('📈', 'P&L', 'ui:pnl'));
  if (ent.isAdmin) {
    cells.push(cell('🛡', 'Admin', 'ui:admin_menu'));
  }
  cells.push(cell('❓', 'Help', 'ui:help'));
  cells.push(cell('🏠', 'Menu', 'ui:menu'));
  return grid3(cells);
}

export function adminControlKeyboard(ent: MenuEntitlements): InlineBtn[][] {
  const cells: InlineBtn[] = [
    cell('👥', 'Users', 'ui:admin_users'),
    cell('📡', 'Broadcast', 'ui:admin_broadcast_hint'),
    cell('📊', 'Platform', 'ui:admin_platform'),
    cell('⏸', 'Pause all', 'ui:admin_pause_all'),
    cell('▶️', 'Resume all', 'ui:admin_resume_all'),
    cell('🚫', 'Ban', 'ui:admin_ban_hint'),
    cell('📊', 'My status', 'ui:status'),
    cell(
      ent.bcGameConnected ? '✅' : '🔐',
      'BC.Game',
      'ui:login'
    ),
  ];
  if (ent.engineRunning) {
    cells.push(cell('⏸', 'My pause', 'ui:pause'));
    cells.push(cell('🔄', 'My resume', 'ui:resume'));
  } else {
    cells.push(cell('▶️', 'My engine', 'ui:startengine'));
  }
  cells.push(cell('⚙️', 'Settings', 'ui:settings'));
  cells.push(cell('❓', 'Help', 'ui:help'));
  cells.push(cell('🏠', 'Menu', 'ui:menu'));
  return grid3(cells);
}

export function onboardingKeyboard(): InlineBtn[][] {
  return grid3([
    cell('🔐', 'Login', 'ui:login'),
    cell('📋', 'Plans', 'ui:subscribe'),
    cell('⚙️', 'Settings', 'ui:settings'),
    cell('❓', 'Help', 'ui:help'),
    cell('🏠', 'Menu', 'ui:menu'),
  ]);
}

export function connectedHomeKeyboard(ent: MenuEntitlements): InlineBtn[][] {
  const cells: InlineBtn[] = [
    cell(
      ent.engineRunning ? '⏸' : '▶️',
      ent.engineRunning ? 'Pause' : 'Start',
      ent.engineRunning ? 'ui:pause' : 'ui:startengine'
    ),
    cell('📊', 'Status', 'ui:status'),
    cell('🔐', 'BC.Game', 'ui:login'),
  ];
  if (ent.canViewAnalytics) {
    cells.push(cell('💰', 'Balance', 'ui:balance'));
    cells.push(cell('📈', 'P&L', 'ui:pnl'));
  }
  cells.push(cell('⚙️', 'Settings', 'ui:settings'));
  if (ent.isAdmin) {
    cells.push(cell('🛡', 'Admin', 'ui:admin_menu'));
  }
  cells.push(cell('🏠', 'Menu', 'ui:menu'));
  return grid3(cells);
}

export function settingsKeyboard(ent: MenuEntitlements): InlineBtn[][] {
  const cells: InlineBtn[] = [];
  if (ent.canConfigureStake) {
    cells.push(cell('💵', 'Stake', 'ui:stake'));
  }
  if (ent.canSubscribe) {
    cells.push(cell('📋', 'Plans', 'ui:subscribe'));
  }
  if (ent.canControlEngine) {
    cells.push(cell('🛠', 'Mode', 'ui:mode'));
  }
  if (ent.canLogin) {
    cells.push(cell('🔐', 'Login', 'ui:login'));
    cells.push(cell('🚪', 'Logout', 'ui:logout'));
  }
  if (ent.isAdmin) {
    cells.push(cell('🛡', 'Admin', 'ui:admin_menu'));
  }
  cells.push(cell('«', 'Back', 'ui:menu'));
  return grid3(cells);
}

export function modeKeyboard(allowedModes: string[]): InlineBtn[][] {
  const modes =
    allowedModes.length > 0
      ? allowedModes
      : ['observe-only', 'dry-run', 'live', 'maintenance'];
  const cells: InlineBtn[] = modes.map((m) => {
    const short =
      m === 'observe-only' ? 'Observe' : m === 'dry-run' ? 'Dry-run' : m === 'maintenance' ? 'Maint' : 'Live';
    const emoji =
      m === 'live' ? '🔴' : m === 'dry-run' ? '🟡' : m === 'maintenance' ? '🔧' : '👁';
    return cell(emoji, short, `ui:mode_set:${m}`);
  });
  cells.push(cell('«', 'Back', 'ui:settings'));
  return grid3(cells);
}

export function helpText(ent: MenuEntitlements): string {
  const roleLabel =
    ent.role === 'admin' ? 'Admin' : ent.role === 'operator' ? 'Operator' : 'Tenant';
  const lines = [
    `🚀 *CrashWave Help* (${roleLabel})`,
    '',
    '*Account*',
    '/start — Home',
    '/menu — Icon control panel',
    '/status — Status dashboard',
    '/login — Connect BC.Game',
    '/logout — Clear login conversation',
    '',
  ];
  if (ent.canControlEngine) {
    lines.push(
      '*Engine*',
      '/startengine — Start / resume',
      '/pause /resume /stop',
      '/mode — Operating mode',
      ''
    );
  }
  if (ent.canViewAnalytics) {
    lines.push('*Analytics*', '/balance /pnl /daily /entries /analytics', '');
  }
  if (ent.isAdmin) {
    lines.push(
      '*Admin*',
      '/admin_menu — Admin panel',
      '/admin_users /admin_pause_all /admin_resume_all',
      '/admin_ban /admin_broadcast',
      ''
    );
  }
  lines.push(
    '*System*',
    '/health /session /help',
    '',
    '_Menus use a 3-column icon grid (Telegram attachment style). Access is enforced by role._'
  );
  return lines.join('\n');
}

export function menuHeaderText(
  tenant: Tenant | null,
  ent: MenuEntitlements,
  engineLabel?: string
): string {
  const engine = engineLabel ?? (ent.engineRunning ? 'running' : 'stopped');
  const bc = ent.bcGameConnected ? 'connected' : 'not connected';
  const roleLabel =
    ent.role === 'admin' ? 'ADMIN' : ent.role === 'operator' ? 'OPERATOR' : 'TENANT';
  const lines = [`🚀 *CRASHWAVE* — ${roleLabel}`, ''];
  if (tenant) {
    lines.push('Tenant: `' + tenant.id.slice(0, 8) + '…`');
    lines.push('Account: *' + ent.tenantStatus + '*');
  }
  lines.push('Engine: *' + engine + '*');
  lines.push('BC.Game: *' + bc + '*');
  lines.push('');
  lines.push('_Tap a tile below._');
  return lines.join('\n');
}
