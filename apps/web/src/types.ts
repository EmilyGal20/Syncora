export interface User { id:string; email:string; full_name:string; is_active:boolean; organization_id:string; department_id:string|null; team_id:string|null; roles:string[]; permissions:string[]; last_login_at:string|null; created_at:string }
export interface NavItem { id:string; parent_id:string|null; title:string; icon:string; route:string|null; item_type:string; order:number; required_permission:string|null; module:string|null; enabled:boolean }
export interface Widget { id:string; type:string; title:string; position:number; width:number; height:number; configuration:Record<string, unknown> }
export interface Dashboard { id:string; name:string; widgets:Widget[] }
export interface Task { id:string; title:string; description:string; status:'todo'|'in_progress'|'blocked'|'completed'; priority:string; due_date:string|null; tags:string[] }

