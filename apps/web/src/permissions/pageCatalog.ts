export type Level = 'view' | 'edit' | 'manage'
export interface FeatureDef { code: string; labelKey: string; level: Level; label?: string }
export interface PageDef { id: string; titleKey: string; show: string[]; features: FeatureDef[]; title?: string }

export const GRANTOR_CODES = [
  'access_requests.manage',
  'users.edit',
  'roles.manage',
  'users.create',
  'users.manage',
] as const

export const PAGE_CATALOG: PageDef[] = [
  {
    id: 'dashboard',
    titleKey: 'nav.dashboard',
    show: ['dashboard.view'],
    features: [
      { code: 'dashboard.view', labelKey: 'perm.dashboard.open', level: 'view' },
      { code: 'dashboard.manage', labelKey: 'perm.dashboard.widgets', level: 'manage' },
      { code: 'dashboards.create', labelKey: 'perm.dashboard.create', level: 'edit' },
      { code: 'dashboards.edit', labelKey: 'perm.dashboard.edit', level: 'edit' },
      { code: 'dashboards.delete', labelKey: 'perm.dashboard.delete', level: 'manage' },
      { code: 'dashboards.publish', labelKey: 'perm.dashboard.publish', level: 'manage' },
      { code: 'dashboards.assign', labelKey: 'perm.dashboard.assign', level: 'manage' },
      { code: 'dashboards.export_pdf', labelKey: 'perm.dashboard.exportPdf', level: 'manage' },
      { code: 'dashboards.export_excel', labelKey: 'perm.dashboard.exportExcel', level: 'manage' },
    ],
  },
  {
    id: 'tasks',
    titleKey: 'nav.tasks',
    show: ['tasks.view'],
    features: [
      { code: 'tasks.view', labelKey: 'perm.tasks.open', level: 'view' },
      { code: 'tasks.create', labelKey: 'perm.tasks.create', level: 'edit' },
      { code: 'tasks.edit', labelKey: 'perm.tasks.edit', level: 'edit' },
      { code: 'tasks.delete', labelKey: 'perm.tasks.delete', level: 'manage' },
    ],
  },
  {
    id: 'engine',
    titleKey: 'engine.section',
    show: ['engine.dashboard'],
    features: [
      { code: 'engine.dashboard', labelKey: 'engine.dashboard', level: 'view' },
      { code: 'engine.tasks', labelKey: 'engine.tasks', level: 'view' },
      { code: 'engine.board', labelKey: 'engine.board', level: 'view' },
      { code: 'engine.projects', labelKey: 'engine.projects', level: 'view' },
      { code: 'engine.calendar', labelKey: 'engine.calendar', level: 'view' },
      { code: 'engine.analytics', labelKey: 'engine.analytics', level: 'view' },
      { code: 'engine.planner', labelKey: 'engine.planner', level: 'view' },
    ],
  },
  {
    id: 'schedule',
    titleKey: 'nav.schedule',
    show: ['schedule.view'],
    features: [
      { code: 'schedule.view', labelKey: 'perm.schedule.open', level: 'view' },
      { code: 'schedule.create', labelKey: 'perm.schedule.create', level: 'edit' },
      { code: 'schedule.edit', labelKey: 'perm.schedule.edit', level: 'edit' },
      { code: 'schedule.delete', labelKey: 'perm.schedule.delete', level: 'manage' },
      { code: 'schedule.manage', labelKey: 'perm.schedule.manage', level: 'manage' },
      { code: 'booking.manage', labelKey: 'perm.schedule.booking', level: 'manage' },
    ],
  },
  {
    id: 'notes',
    titleKey: 'notes.heading',
    show: ['notes.view_own'],
    features: [
      { code: 'notes.view_own', labelKey: 'perm.notes.own', level: 'view' },
      { code: 'notes.create', labelKey: 'perm.notes.create', level: 'edit' },
      { code: 'notes.edit_own', labelKey: 'perm.notes.edit', level: 'edit' },
      { code: 'notes.delete_own', labelKey: 'perm.notes.delete', level: 'manage' },
      { code: 'notes.view_shared', labelKey: 'perm.notes.shared', level: 'view' },
      { code: 'notes.manage_shared', labelKey: 'perm.notes.manageShared', level: 'manage' },
    ],
  },
  {
    id: 'teams',
    titleKey: 'nav.teams',
    show: ['teams.view'],
    features: [
      { code: 'teams.view', labelKey: 'perm.teams.open', level: 'view' },
      { code: 'teams.manage', labelKey: 'perm.teams.manage', level: 'manage' },
      { code: 'departments.view', labelKey: 'perm.teams.departments', level: 'view' },
      { code: 'departments.manage', labelKey: 'perm.teams.departmentsManage', level: 'manage' },
    ],
  },
  {
    id: 'announcements',
    titleKey: 'nav.announcements',
    show: ['announcements.view'],
    features: [
      { code: 'announcements.view', labelKey: 'perm.announcements.open', level: 'view' },
      { code: 'announcements.create', labelKey: 'perm.announcements.create', level: 'edit' },
      { code: 'announcements.edit', labelKey: 'perm.announcements.edit', level: 'edit' },
      { code: 'announcements.delete', labelKey: 'perm.announcements.delete', level: 'manage' },
      { code: 'announcements.manage', labelKey: 'perm.announcements.manage', level: 'manage' },
    ],
  },
  {
    id: 'files',
    titleKey: 'settings.admin.files',
    show: ['files.view'],
    features: [
      { code: 'files.view', labelKey: 'perm.files.open', level: 'view' },
      { code: 'files.upload', labelKey: 'perm.files.upload', level: 'edit' },
      { code: 'files.download', labelKey: 'perm.files.download', level: 'view' },
      { code: 'files.delete', labelKey: 'perm.files.delete', level: 'manage' },
    ],
  },
  {
    id: 'band',
    titleKey: 'settings.admin.band',
    show: ['shows.view', 'rehearsals.view', 'songs.view', 'setlists.view', 'equipment.view', 'expenses.view'],
    features: [
      { code: 'shows.view', labelKey: 'perm.band.shows', level: 'view' },
      { code: 'shows.manage', labelKey: 'perm.band.showsManage', level: 'manage' },
      { code: 'rehearsals.view', labelKey: 'perm.band.rehearsals', level: 'view' },
      { code: 'rehearsals.manage', labelKey: 'perm.band.rehearsalsManage', level: 'manage' },
      { code: 'songs.view', labelKey: 'perm.band.songs', level: 'view' },
      { code: 'songs.manage', labelKey: 'perm.band.songsManage', level: 'manage' },
      { code: 'setlists.view', labelKey: 'perm.band.setlists', level: 'view' },
      { code: 'setlists.manage', labelKey: 'perm.band.setlistsManage', level: 'manage' },
      { code: 'setlists.export_pdf', labelKey: 'perm.band.setlistsPdf', level: 'manage' },
      { code: 'equipment.view', labelKey: 'perm.band.equipment', level: 'view' },
      { code: 'equipment.manage', labelKey: 'perm.band.equipmentManage', level: 'manage' },
      { code: 'expenses.view', labelKey: 'perm.band.expenses', level: 'view' },
      { code: 'expenses.manage', labelKey: 'perm.band.expensesManage', level: 'manage' },
      { code: 'expenses.export_excel', labelKey: 'perm.band.expensesExcel', level: 'manage' },
    ],
  },
  {
    id: 'settings',
    titleKey: 'nav.settings',
    show: ['settings.view'],
    features: [
      { code: 'settings.view', labelKey: 'perm.settings.open', level: 'view' },
      { code: 'profile.view', labelKey: 'perm.settings.profileView', level: 'view' },
      { code: 'profile.edit', labelKey: 'perm.settings.profileEdit', level: 'edit' },
      { code: 'settings.manage', labelKey: 'perm.settings.workspace', level: 'manage' },
      { code: 'users.view', labelKey: 'perm.settings.users', level: 'view' },
      { code: 'users.create', labelKey: 'perm.settings.usersCreate', level: 'edit' },
      { code: 'users.edit', labelKey: 'perm.settings.usersEdit', level: 'edit' },
      { code: 'users.delete', labelKey: 'perm.settings.usersDelete', level: 'manage' },
      { code: 'users.manage', labelKey: 'perm.settings.usersManage', level: 'manage' },
      { code: 'roles.manage', labelKey: 'perm.settings.roles', level: 'manage' },
      { code: 'navigation.manage', labelKey: 'perm.settings.navigation', level: 'manage' },
      { code: 'audit.view', labelKey: 'perm.settings.audit', level: 'view' },
      { code: 'access_requests.manage', labelKey: 'perm.settings.requests', level: 'manage' },
      { code: 'support.view', labelKey: 'perm.settings.support', level: 'view' },
      { code: 'support.reply', labelKey: 'perm.settings.supportReply', level: 'edit' },
      { code: 'support.manage', labelKey: 'perm.settings.supportManage', level: 'manage' },
      { code: 'support.internal_notes', labelKey: 'perm.settings.supportNotes', level: 'manage' },
    ],
  },
]

export function levelOf(code: string): Level {
  if (/\.(manage|delete|publish|assign|export|internal_notes)/.test(code) || code.includes('delete')) return 'manage'
  if (/\.(create|edit|upload|reply)/.test(code)) return 'edit'
  return 'view'
}

export function scopeOf(level: Level) {
  return level === 'manage' ? 'ORGANIZATION' : level === 'edit' ? 'TEAM' : 'OWN'
}

export function human(code: string) {
  return code.split('.').map((part) => part.charAt(0).toUpperCase() + part.slice(1).replaceAll('_', ' ')).join(' ')
}

export function buildPages(available: Set<string>, t: (key: string) => string): Array<PageDef & { title: string; features: Array<FeatureDef & { label: string }> }> {
  const used = new Set<string>()
  const pages = PAGE_CATALOG.map((page) => {
    const features = page.features
      .filter((feature) => available.has(feature.code))
      .map((feature) => {
        used.add(feature.code)
        return { ...feature, label: t(feature.labelKey) }
      })
    return {
      ...page,
      title: t(page.titleKey),
      show: page.show.filter((code) => available.has(code)),
      features,
    }
  }).filter((page) => page.features.length)
  const leftover = [...available].filter((code) => !used.has(code) && !code.startsWith('platform.'))
  if (leftover.length) {
    pages.push({
      id: 'other',
      titleKey: 'settings.admin.other',
      title: t('settings.admin.other'),
      show: leftover.filter((code) => levelOf(code) === 'view'),
      features: leftover.map((code) => ({ code, labelKey: code, label: human(code), level: levelOf(code) })),
    })
  }
  return pages
}
