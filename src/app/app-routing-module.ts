import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Workitems } from './component/workitems/workitems';
import { Subcontractor } from './component/subcontractor/subcontractor';
import { ProjectDetails } from './component/projects/project-details/project-details';
import { ProjectList } from './component/projects/project-list/project-list';
import { Rfq } from './component/projects/rfq/rfq';
import { AddWorkitem } from './component/add-workitem/add-workitem';
import { AddSubcontractor } from './component/add-subcontractor/add-subcontractor';
import { RfqAdd } from './component/projects/rfq-add/rfq-add';
import { ViewProjects } from './component/projects/view-projects/view-projects';
import { SSOLogin } from './component/sso-login/sso-login';
import { AuthGuard } from './auth.guard';
import { AlreadyAuthGuard } from './already-auth.guard';


const routes: Routes = [
  { path: 'login', component: SSOLogin, canActivate: [AlreadyAuthGuard] },

{ path: '', redirectTo: 'workitems', pathMatch: 'full' }, // no guard here

{ path: 'workitems', component: Workitems, canActivate: [AuthGuard] },
  { path: 'subcontractor', component: Subcontractor, canActivate: [AuthGuard] },
  { path: 'projectdetails', component: ProjectDetails, canActivate: [AuthGuard] },
  { path: 'projectlist', component: ProjectList, canActivate: [AuthGuard] },
  { path: 'rfq', component: Rfq, canActivate: [AuthGuard] },
  { path: 'add-workitem', component: AddWorkitem, canActivate: [AuthGuard] },
  { path: 'add-subcontractor', component: AddSubcontractor, canActivate: [AuthGuard] },
  { path: 'add-rfq', component: RfqAdd, canActivate: [AuthGuard] },
{ path: 'view-projects/:id', component: ViewProjects, canActivate: [AuthGuard] },

{ path: '**', redirectTo: 'login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
