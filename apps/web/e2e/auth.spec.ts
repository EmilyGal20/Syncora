import { expect, test } from '@playwright/test'
test('unauthenticated users are sent to login',async({page})=>{await page.goto('/dashboard');await expect(page).toHaveURL(/\/login/);await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible()})
test('login form remains usable at responsive viewport',async({page})=>{await page.goto('/login');await expect(page.getByLabel('Work email')).toBeVisible();await expect(page.getByRole('button',{name:'Sign in'})).toBeVisible()})
test('admin can sign in and use configured workspace',async({page,isMobile})=>{
  await page.goto('/login')
  await page.getByRole('button',{name:'Sign in'}).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading',{name:'Good morning'})).toBeVisible()
  await expect(page.getByText('Work at a glance')).toBeVisible()
  if(isMobile){
    await page.getByRole('button',{name:'Open navigation'}).click()
  }
  await page.getByText('Administration',{exact:true}).click()
  await expect(page.getByRole('heading',{name:'Admin Center'})).toBeVisible()
  await page.getByRole('tab',{name:'Users'}).click()
  await expect(page.getByText('Maya Cohen')).toBeVisible()
})
