import { expect, test } from '@playwright/test'
test('unauthenticated users are sent to login',async({page})=>{await page.goto('/dashboard');await expect(page).toHaveURL(/\/login/);await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible()})
test('login form remains usable at responsive viewport',async({page})=>{await page.goto('/login');await expect(page.getByLabel('Work email')).toBeVisible();await expect(page.getByRole('button',{name:'Sign in'})).toBeVisible()})
test('branding and refresh-cookie auth survive reload and expired access token',async({page})=>{await page.goto('/login');const logo=page.getByRole('img',{name:/Syncora/}).first();await expect(logo).toBeVisible();expect(await logo.evaluate(el=>({width:(el as HTMLImageElement).naturalWidth,height:(el as HTMLImageElement).naturalHeight}))).toEqual({width:384,height:384});await page.getByRole('button',{name:'Sign in'}).click();await expect(page).toHaveURL(/\/dashboard/);await page.reload();await expect(page.getByRole('heading',{name:'Good morning'})).toBeVisible();await page.evaluate(()=>sessionStorage.setItem('syncora_access_token','invalid.expired.token'));await page.reload();await expect(page.getByRole('heading',{name:'Good morning'})).toBeVisible();await page.getByRole('button',{name:'Profile menu'}).click();await page.getByRole('menuitem',{name:'Sign out'}).click();await expect(page).toHaveURL(/\/login/)})
test('admin can sign in and use configured workspace',async({page,isMobile})=>{
  await page.goto('/login')
  await page.getByRole('button',{name:'Sign in'}).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading',{name:'Good morning'})).toBeVisible()
  await expect(page.getByText('Work at a glance')).toBeVisible()
  if(isMobile){
    await page.getByRole('button',{name:'Open navigation'}).click()
  }
  await page.getByRole('button',{name:'Administration'}).click()
  await expect(page.getByRole('heading',{name:'Admin Center'})).toBeVisible()
  await page.getByRole('tab',{name:'Users'}).click()
  await expect(page.getByText('Maya Cohen')).toBeVisible()
})
test('member has scoped navigation, creates own task, and cannot call admin API',async({page,isMobile})=>{
  await page.goto('/login')
  await page.getByLabel('Work email').fill('manager@syncora.dev')
  await page.getByLabel('Password').fill('Manager123!')
  await page.getByRole('button',{name:'Sign in'}).click()
  await expect(page).toHaveURL(/\/dashboard/)
  if(isMobile)await page.getByRole('button',{name:'Open navigation'}).click()
  await expect(page.getByText('Administration',{exact:true})).toHaveCount(0)
  await page.goto('/tasks')
  await page.getByRole('button',{name:'New task'}).click()
  await page.getByLabel('Title').fill('Playwright personal task')
  await page.getByRole('button',{name:'Save'}).click()
  await expect(page.getByText('Playwright personal task').first()).toBeVisible()
  const status=await page.evaluate(async()=>{const token=sessionStorage.getItem('syncora_access_token');return (await fetch('/api/v1/users',{headers:{Authorization:`Bearer ${token}`}})).status})
  expect(status).toBe(403)
})
test('language and theme change without refresh',async({page})=>{
  await page.goto('/login');await page.getByRole('button',{name:'Sign in'}).click();await expect(page).toHaveURL(/\/dashboard/);await page.goto('/settings')
  await page.getByRole('combobox').nth(0).click();await page.getByRole('option',{name:'עברית'}).click()
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dir)).toBe('rtl')
  await page.getByRole('combobox').nth(1).click();await page.getByRole('option',{name:'כהה'}).click()
  await expect(page.getByRole('heading',{name:'הגדרות'})).toBeVisible()
  await page.getByRole('combobox').nth(0).click();await page.getByRole('option',{name:'English'}).click()
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dir)).toBe('ltr')
  await page.getByRole('combobox').nth(1).click();await page.getByRole('option',{name:'Light'}).click()
})
test('calendar, teams, and announcements render from protected APIs',async({page})=>{
  await page.goto('/login');await page.getByRole('button',{name:'Sign in'}).click();await expect(page).toHaveURL(/\/dashboard/)
  await page.goto('/schedule');await expect(page.getByRole('heading',{name:'Schedule'})).toBeVisible();await expect(page.locator('.fc')).toBeVisible()
  await page.goto('/teams');await expect(page.getByRole('heading',{name:'Teams'})).toBeVisible();await expect(page.getByText('Product')).toBeVisible()
  await page.goto('/announcements');await expect(page.getByRole('heading',{name:'Announcements'})).toBeVisible();await expect(page.getByText('Welcome to Syncora')).toBeVisible()
})
test('admin user override immediately grants and denies active-session access',async({page,isMobile})=>{
  test.skip(!!isMobile,'Permission table workflow is covered on desktop; mobile authorization is covered separately')
  const login=async(email:string,password:string)=>{await page.goto('/login');await page.getByLabel('Work email').fill(email);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();await expect(page).toHaveURL(/\/dashboard/)}
  const editOverride=async(state:'Allow'|'Deny'|'Inherit')=>{await page.goto('/admin');await page.getByRole('tab',{name:'Users'}).click();await page.getByText('Maya Cohen').click();await page.getByRole('tab',{name:'Permissions'}).click();await page.getByLabel('teams.manage override').click();await page.getByRole('option',{name:state}).click();await page.getByRole('button',{name:'Save permission overrides'}).click();await page.getByRole('button',{name:'Close'}).click()}
  const switchUser=async(email:string,password:string)=>{await page.evaluate(()=>sessionStorage.clear());await login(email,password)}
  await login('admin@syncora.dev','ChangeMe123!');await editOverride('Allow');await switchUser('manager@syncora.dev','Manager123!');await page.goto('/teams');await expect(page.getByRole('button',{name:'New team'})).toBeVisible();expect(await page.evaluate(async()=>{const token=sessionStorage.getItem('syncora_access_token');return (await fetch('/api/v1/teams',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'})).status})).toBe(422)
  await switchUser('admin@syncora.dev','ChangeMe123!');await editOverride('Deny');await switchUser('manager@syncora.dev','Manager123!');await page.goto('/teams');await expect(page.getByRole('button',{name:'New team'})).toHaveCount(0);expect(await page.evaluate(async()=>{const token=sessionStorage.getItem('syncora_access_token');return (await fetch('/api/v1/teams',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'})).status})).toBe(403)
  await switchUser('admin@syncora.dev','ChangeMe123!');await editOverride('Inherit')
})
