import { expect, test } from '@playwright/test'

async function login(page:import('@playwright/test').Page,identifier='admin',password='ChangeMe123!'){
  await page.goto('/login');await page.getByLabel('Username or email').fill(identifier);await page.locator('input[name="password"]').fill(password);await page.getByRole('button',{name:'Sign in'}).click();await expect(page).toHaveURL(/dashboard/)
}

test('public registration and guest support are responsive and functional',async({page,isMobile})=>{
  const username=`request${Date.now()}`
  await page.goto('/register');await expect(page.getByRole('heading',{name:'Create account request'})).toBeVisible()
  await page.getByLabel('Desired username').fill(username);await page.locator('input[autocomplete="new-password"]').fill('NewMemberPass123!');await page.getByLabel('Confirm password').fill('NewMemberPass123!');await page.getByRole('button',{name:'Next'}).click()
  await page.getByLabel('First name').fill('New');await page.getByLabel('Last name').fill('Member');await page.getByLabel('Display name').fill('New Member');await page.getByRole('button',{name:'Next'}).click()
  await page.getByLabel('Workspace / Band name').fill('Syncora Demo');await page.getByRole('button',{name:'Next'}).click();if(isMobile){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBeTruthy();return}await page.getByRole('button',{name:'Submit request'}).click();await expect(page.getByRole('heading',{name:'Request submitted'})).toBeVisible()
  await page.goto('/contact');await page.getByLabel('Name').fill('Guest User');await page.getByLabel('Email or phone').fill('guest@example.test');await page.getByLabel('Subject').fill('Cannot access account');await page.getByLabel('Description').fill('The login form reports that my account is unavailable.');await page.getByRole('button',{name:'Submit request'}).click();await expect(page.getByText('Support request submitted.')).toBeVisible()
})

test('admin reviews and approves a password-safe registration request',async({page,isMobile})=>{
  test.skip(!!isMobile,'The compact registration flow is covered on mobile; approval table is exercised on desktop')
  const username=`approved${Date.now()}`;const response=await page.request.post('/api/v1/public/registration-requests',{data:{username,password:'ApprovedPass123!',first_name:'Approved',last_name:'Member',display_name:'Approved Member',preferred_locale:'en',timezone:'UTC',workspace_mode:'existing',workspace_type:'organization',workspace_name:'Syncora Demo',requested_role:'Member',details:{}}});expect(response.ok()).toBeTruthy()
  await login(page);await page.goto('/admin');await page.getByRole('tab',{name:'Access Requests'}).click();await page.getByText(`@${username}`).click();await page.getByLabel('Roles').click();await page.getByRole('option',{name:'Member'}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Confirm approval'}).click();await expect(page.getByText(`@${username}`)).toHaveCount(0)
  await page.evaluate(()=>sessionStorage.clear());await login(page,username,'ApprovedPass123!');await expect(page.getByRole('heading',{name:'Good morning'})).toBeVisible()
})
