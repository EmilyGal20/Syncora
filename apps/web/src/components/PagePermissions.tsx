import ExpandMore from '@mui/icons-material/ExpandMore'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Chip, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { GRANTOR_CODES, type PageDef, buildPages, levelOf, scopeOf } from '../permissions/pageCatalog'

type Scope = 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ORGANIZATION'
type Level = 'view' | 'edit' | 'manage'
interface Permission { code: string; group: string; description: string }
interface Grant { permission_code: string; scope: Scope; effect: 'allow' | 'deny' }
interface Role { id: string; name: string; description: string; default_locale: string | null; grants: Grant[] }
interface Access { role_grants: Grant[]; overrides: Grant[]; effective: Record<string, Scope> }
interface Person { id: string; full_name: string; email: string | null; roles: string[] }

export function PermissionAccordion({
  pages,
  allowed,
  onToggle,
  onTogglePage,
}: {
  pages: Array<PageDef & { title: string; features: Array<{ code: string; label: string }> }>
  allowed: Set<string>
  onToggle: (code: string, on: boolean) => void
  onTogglePage: (page: PageDef, on: boolean) => void
}) {
  const { t } = useTranslation()
  const pageVisible = (page: PageDef) =>
    page.show.length ? page.show.every((code) => allowed.has(code)) : page.features.some((feature) => allowed.has(feature.code))
  return (
    <Box>
      {pages.map((page) => (
        <Accordion key={page.id} disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <FormControlLabel
              onClick={(event) => event.stopPropagation()}
              onFocus={(event) => event.stopPropagation()}
              control={<Checkbox checked={pageVisible(page)} onChange={(_, checked) => onTogglePage(page, checked)} />}
              label={<Typography fontWeight={700}>{page.title}</Typography>}
            />
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('settings.admin.pageIncludes')}</Typography>
            <Stack>
              {page.features.map((feature, index) => (
                <FormControlLabel
                  key={`${page.id}-${feature.code}-${index}`}
                  control={<Checkbox checked={allowed.has(feature.code)} onChange={(_, checked) => onToggle(feature.code, checked)} />}
                  label={feature.label}
                />
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  )
}

export function usePermissionPages(codes?: string[]) {
  const { t } = useTranslation()
  const permissions = useQuery({ queryKey: ['permissions'], queryFn: async () => (await api.get<Permission[]>('/permissions')).data })
  const available = useMemo(() => new Set((codes ?? permissions.data?.map((item) => item.code) ?? []).filter(Boolean)), [codes, permissions.data])
  const pages = useMemo(() => buildPages(available, t), [available, t])
  return { permissions, pages }
}

function toggleCode(current: Set<string>, code: string, on: boolean) {
  const next = new Set(current)
  if (on) next.add(code)
  else next.delete(code)
  return next
}

function togglePageCodes(current: Set<string>, page: PageDef, on: boolean) {
  const next = new Set(current)
  const codes = [...new Set([...page.show, ...page.features.map((feature) => feature.code)])]
  for (const code of codes) {
    if (on) next.add(code)
    else next.delete(code)
  }
  return next
}

export function PagePermissions({
  mode = 'full',
  allowed,
  onAllowedChange,
  subjectName,
}: {
  mode?: 'full' | 'picker'
  allowed?: Set<string>
  onAllowedChange?: (next: Set<string>) => void
  subjectName?: string
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [target, setTarget] = useState<'organization' | 'user'>('organization')
  const [roleId, setRoleId] = useState('')
  const [userId, setUserId] = useState('')
  const [localAllowed, setLocalAllowed] = useState<Set<string>>(new Set())
  const [english, setEnglish] = useState(true)
  const [hebrew, setHebrew] = useState(false)
  const [allowLocale, setAllowLocale] = useState(true)
  const [hoverLabel, setHoverLabel] = useState('')
  const roles = useQuery({ queryKey: ['role-access'], queryFn: async () => (await api.get<Role[]>('/access/roles')).data })
  const users = useQuery({ queryKey: ['users', 'permissions'], queryFn: async () => (await api.get<{ items: Person[] }>('/users', { params: { page_size: 100 } })).data.items })
  const { permissions, pages } = usePermissionPages()
  const selectedRole = roles.data?.find((role) => role.id === roleId)
  const selectedUser = users.data?.find((person) => person.id === userId)
  const access = useQuery({ queryKey: ['user-access', userId], enabled: target === 'user' && !!userId && mode === 'full', queryFn: async () => (await api.get<Access>(`/users/${userId}/access`)).data })
  const currentAllowed = allowed ?? localAllowed
  const setAllowed = onAllowedChange ?? setLocalAllowed
  useEffect(() => {
    if (!roleId && roles.data?.[0]) setRoleId(roles.data[0].id)
  }, [roles.data, roleId])
  useEffect(() => {
    if (target !== 'user' || userId || !users.data?.[0]) return
    setUserId(users.data[0].id)
  }, [target, userId, users.data])
  useEffect(() => {
    if (mode !== 'full' || allowed) return
    if (target === 'organization' && selectedRole) {
      setLocalAllowed(new Set(selectedRole.grants.filter((grant) => grant.effect === 'allow').map((grant) => grant.permission_code)))
      setEnglish((selectedRole.default_locale ?? 'en') === 'en')
      setHebrew(selectedRole.default_locale === 'he')
    }
  }, [target, selectedRole, mode, allowed])
  useEffect(() => {
    if (mode !== 'full' || allowed || target !== 'user' || !access.data) return
    setLocalAllowed(new Set(Object.keys(access.data.effective)))
  }, [target, access.data, mode, allowed])
  const save = useMutation({
    mutationFn: async () => {
      const grants = [...currentAllowed].map((code) => ({ permission_code: code, effect: 'allow' as const, scope: scopeOf(levelOf(code)) }))
      if (target === 'organization') {
        const locale = hebrew && !english ? 'he' : 'en'
        await api.patch(`/roles/${roleId}`, { grants, default_locale: locale })
        await api.patch('/workspace/settings', { default_locale: locale, allow_user_locale: allowLocale })
        return
      }
      const roleAllowed = new Set((access.data?.role_grants ?? []).filter((grant) => grant.effect === 'allow').map((grant) => grant.permission_code))
      const overrides: Grant[] = []
      for (const permission of permissions.data ?? []) {
        const want = currentAllowed.has(permission.code)
        const inherited = roleAllowed.has(permission.code)
        if (want && !inherited) overrides.push({ permission_code: permission.code, effect: 'allow', scope: scopeOf(levelOf(permission.code)) })
        if (!want && inherited) overrides.push({ permission_code: permission.code, effect: 'deny', scope: 'OWN' })
      }
      await api.put(`/users/${userId}/grants`, overrides)
      const locale = hebrew && !english ? 'he' : english ? 'en' : null
      if (locale) await api.patch(`/users/${userId}/preferences`, { locale })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['role-access'] })
      await qc.invalidateQueries({ queryKey: ['user-access'] })
      await qc.invalidateQueries({ queryKey: ['navigation'] })
    },
  })
  function applyType(kind: Level) {
    const next = new Set<string>()
    for (const permission of permissions.data ?? []) {
      const level = levelOf(permission.code)
      if (kind === 'view' && level === 'view') next.add(permission.code)
      if (kind === 'edit' && (level === 'view' || level === 'edit')) next.add(permission.code)
      if (kind === 'manage') next.add(permission.code)
    }
    setAllowed(next)
  }
  const selectedLevel = useMemo(() => {
    const all = permissions.data ?? []
    if (!all.length) return null
    const matches = (kind: Level) => {
      for (const permission of all) {
        const level = levelOf(permission.code)
        const want = kind === 'manage' || (kind === 'edit' && (level === 'view' || level === 'edit')) || (kind === 'view' && level === 'view')
        if (want !== currentAllowed.has(permission.code)) return false
      }
      return true
    }
    if (matches('manage')) return 'manage'
    if (matches('edit')) return 'edit'
    if (matches('view')) return 'view'
    return null
  }, [currentAllowed, permissions.data])
  const selectedLevelLabel = selectedLevel ? t(`settings.admin.${selectedLevel === 'manage' ? 'manager' : selectedLevel}`) : t('settings.admin.customLevel')
  const subject = subjectName
    || (target === 'organization'
      ? (selectedRole?.name ?? t('settings.admin.userType'))
      : (selectedUser?.full_name ?? t('settings.admin.user')))
  const displaySubject = hoverLabel || subject
  return (
    <Box>
      {mode === 'full' && (
        <>
          <Typography variant="h6" sx={{ mb: 1 }}>{t('settings.admin.permissionsTitle')}</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>{t('settings.admin.permissionsHelp')}</Typography>
        </>
      )}
      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} sx={{ mb: 2 }} flexWrap="wrap" alignItems="center">
        {mode === 'full' && (
          <>
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>{t('settings.admin.target')}</InputLabel>
              <Select label={t('settings.admin.target')} value={target} onChange={(e) => setTarget(e.target.value as 'organization' | 'user')}>
                <MenuItem value="organization">{t('settings.admin.organization')}</MenuItem>
                <MenuItem value="user">{t('settings.admin.user')}</MenuItem>
              </Select>
            </FormControl>
            {target === 'organization' && (
              <FormControl sx={{ minWidth: 220 }}>
                <InputLabel>{t('settings.admin.userType')}</InputLabel>
                <Select label={t('settings.admin.userType')} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                  {roles.data?.map((role) => (
                    <MenuItem key={role.id} value={role.id} onMouseEnter={() => setHoverLabel(role.name)} onMouseLeave={() => setHoverLabel('')}>
                      {role.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {target === 'user' && (
              <FormControl sx={{ minWidth: 240 }}>
                <InputLabel>{t('settings.admin.user')}</InputLabel>
                <Select label={t('settings.admin.user')} value={userId} onChange={(e) => setUserId(e.target.value)}>
                  {users.data?.map((person) => (
                    <MenuItem key={person.id} value={person.id} onMouseEnter={() => setHoverLabel(person.full_name)} onMouseLeave={() => setHoverLabel('')}>
                      {person.full_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </>
        )}
        <ToggleButtonGroup
          exclusive
          size="small"
          value={selectedLevel}
          color="primary"
          onChange={(_, kind: Level | null) => { if (kind) applyType(kind) }}
        >
          {(['view', 'edit', 'manage'] as const).map((kind) => (
            <Tooltip key={kind} title={t(`settings.admin.${kind}Hint`)}>
              <ToggleButton value={kind} aria-pressed={selectedLevel === kind}>
                {t(`settings.admin.${kind === 'manage' ? 'manager' : kind}`)}
              </ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>
        <Chip color="primary" label={t('settings.admin.selectedLevel', { name: selectedLevelLabel })} />
        {mode === 'full' && <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>}
        <Chip color="primary" variant="outlined" label={t('settings.admin.editingNow', { name: displaySubject })} />
      </Stack>
      {mode === 'full' && save.isSuccess && <Alert severity="success" sx={{ mb: 2 }}>{t('settings.admin.saved')}</Alert>}
      {mode === 'full' && save.isError && <Alert severity="error" sx={{ mb: 2 }}>{t('common.saveError')}</Alert>}
      <PermissionAccordion pages={pages} allowed={currentAllowed} onToggle={(code, on) => setAllowed(toggleCode(currentAllowed, code, on))} onTogglePage={(page, on) => setAllowed(togglePageCodes(currentAllowed, page, on))} />
      {mode === 'full' && (
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}><Typography fontWeight={700}>{t('settings.language')}</Typography></AccordionSummary>
          <AccordionDetails>
            <Stack>
              <FormControlLabel control={<Checkbox checked={english} onChange={(_, checked) => setEnglish(checked)} />} label={t('settings.admin.showEnglish')} />
              <FormControlLabel control={<Checkbox checked={hebrew} onChange={(_, checked) => setHebrew(checked)} />} label={t('settings.admin.showHebrew')} />
              {target === 'organization' && <FormControlLabel control={<Checkbox checked={allowLocale} onChange={(_, checked) => setAllowLocale(checked)} />} label={t('settings.admin.allowLocale')} />}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  )
}

export function GrantAuthorityPanel() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [target, setTarget] = useState<'organization' | 'user'>('organization')
  const [roleId, setRoleId] = useState('')
  const [userId, setUserId] = useState('')
  const [allowed, setAllowed] = useState<Set<string>>(new Set())
  const [hoverLabel, setHoverLabel] = useState('')
  const roles = useQuery({ queryKey: ['role-access'], queryFn: async () => (await api.get<Role[]>('/access/roles')).data })
  const users = useQuery({ queryKey: ['users', 'permissions'], queryFn: async () => (await api.get<{ items: Person[] }>('/users', { params: { page_size: 100 } })).data.items })
  const permissions = useQuery({ queryKey: ['permissions'], queryFn: async () => (await api.get<Permission[]>('/permissions')).data })
  const selectedRole = roles.data?.find((role) => role.id === roleId)
  const selectedUser = users.data?.find((person) => person.id === userId)
  const access = useQuery({ queryKey: ['user-access', userId], enabled: target === 'user' && !!userId, queryFn: async () => (await api.get<Access>(`/users/${userId}/access`)).data })
  useEffect(() => {
    if (!roleId && roles.data?.[0]) setRoleId(roles.data[0].id)
  }, [roles.data, roleId])
  useEffect(() => {
    if (target !== 'user' || userId || !users.data?.[0]) return
    setUserId(users.data[0].id)
  }, [target, userId, users.data])
  useEffect(() => {
    if (target === 'organization' && selectedRole) {
      setAllowed(new Set(selectedRole.grants.filter((grant) => grant.effect === 'allow' && GRANTOR_CODES.includes(grant.permission_code as typeof GRANTOR_CODES[number])).map((grant) => grant.permission_code)))
    }
  }, [target, selectedRole])
  useEffect(() => {
    if (target !== 'user' || !access.data) return
    setAllowed(new Set(GRANTOR_CODES.filter((code) => code in access.data.effective)))
  }, [target, access.data])
  const save = useMutation({
    mutationFn: async () => {
      if (target === 'organization' && selectedRole) {
        const rest = selectedRole.grants.filter((grant) => !GRANTOR_CODES.includes(grant.permission_code as typeof GRANTOR_CODES[number])).map((grant) => ({ permission_code: grant.permission_code, effect: grant.effect, scope: grant.scope }))
        const grants = [
          ...rest,
          ...GRANTOR_CODES.filter((code) => allowed.has(code)).map((code) => ({ permission_code: code, effect: 'allow' as const, scope: scopeOf(levelOf(code)) })),
        ]
        await api.patch(`/roles/${roleId}`, { grants })
        return
      }
      const roleAllowed = new Set((access.data?.role_grants ?? []).filter((grant) => grant.effect === 'allow').map((grant) => grant.permission_code))
      const existing = (await api.get<Access>(`/users/${userId}/access`)).data
      const currentOverrides = existing.overrides.filter((grant) => !GRANTOR_CODES.includes(grant.permission_code as typeof GRANTOR_CODES[number]))
      const overrides = [...currentOverrides]
      for (const code of GRANTOR_CODES) {
        const want = allowed.has(code)
        const inherited = roleAllowed.has(code)
        if (want && !inherited) overrides.push({ permission_code: code, effect: 'allow', scope: scopeOf(levelOf(code)) })
        if (!want && inherited) overrides.push({ permission_code: code, effect: 'deny', scope: 'OWN' })
      }
      await api.put(`/users/${userId}/grants`, overrides)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['role-access'] })
      await qc.invalidateQueries({ queryKey: ['user-access'] })
    },
  })
  const subject = target === 'organization' ? (selectedRole?.name ?? '') : (selectedUser?.full_name ?? '')
  const availableGrantors = GRANTOR_CODES.filter((code) => (permissions.data ?? []).some((item) => item.code === code))
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>{t('settings.admin.grantorsTitle')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>{t('settings.admin.grantorsHelp')}</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} sx={{ mb: 2 }} flexWrap="wrap" alignItems="center">
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel>{t('settings.admin.target')}</InputLabel>
          <Select label={t('settings.admin.target')} value={target} onChange={(e) => setTarget(e.target.value as 'organization' | 'user')}>
            <MenuItem value="organization">{t('settings.admin.organization')}</MenuItem>
            <MenuItem value="user">{t('settings.admin.user')}</MenuItem>
          </Select>
        </FormControl>
        {target === 'organization' && (
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>{t('settings.admin.userType')}</InputLabel>
            <Select label={t('settings.admin.userType')} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.data?.map((role) => (
                <MenuItem key={role.id} value={role.id} onMouseEnter={() => setHoverLabel(role.name)} onMouseLeave={() => setHoverLabel('')}>{role.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {target === 'user' && (
          <FormControl sx={{ minWidth: 240 }}>
            <InputLabel>{t('settings.admin.user')}</InputLabel>
            <Select label={t('settings.admin.user')} value={userId} onChange={(e) => setUserId(e.target.value)}>
              {users.data?.map((person) => (
                <MenuItem key={person.id} value={person.id} onMouseEnter={() => setHoverLabel(person.full_name)} onMouseLeave={() => setHoverLabel('')}>{person.full_name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>
        <Chip color="primary" variant="outlined" label={t('settings.admin.editingNow', { name: hoverLabel || subject })} />
      </Stack>
      {save.isSuccess && <Alert severity="success" sx={{ mb: 2 }}>{t('settings.admin.saved')}</Alert>}
      {save.isError && <Alert severity="error" sx={{ mb: 2 }}>{t('common.saveError')}</Alert>}
      <Stack>
        {availableGrantors.map((code) => (
          <FormControlLabel
            key={code}
            control={<Checkbox checked={allowed.has(code)} onChange={(_, checked) => setAllowed(toggleCode(allowed, code, checked))} />}
            label={t(`perm.grantor.${code.replaceAll('.', '_')}`)}
          />
        ))}
      </Stack>
    </Box>
  )
}
