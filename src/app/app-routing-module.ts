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

const routes: Routes = [
  { path: 'workitems', component: Workitems },
  { path: '', redirectTo: 'workitems', pathMatch: 'full' }, // default route
  { path: 'subcontractor', component: Subcontractor},
  { path: 'projectdetails', component: ProjectDetails},
  { path: 'projectlist', component: ProjectList},
  { path: 'rfq', component:Rfq},
  { path: 'add-workitem', component:AddWorkitem  },
  { path: 'add-subcontractor', component:AddSubcontractor},
  { path: 'add-rfq', component:RfqAdd},
  { path: 'view-projects', component:ViewProjects}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
