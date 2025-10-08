import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { ProjectList } from './component/projects/project-list/project-list';
import { ProjectDetails } from './component/projects/project-details/project-details';
import { RfqAdd } from './component/projects/rfq-add/rfq-add';
import { Workitems } from './component/workitems/workitems';
import { Subcontractor } from './component/subcontractor/subcontractor';
import { Header } from './shared/header/header';
import { Footer } from './shared/footer/footer';
import { FormsModule,ReactiveFormsModule    } from '@angular/forms';
import { Rfq } from './component/projects/rfq/rfq';
import { AddWorkitem } from './component/add-workitem/add-workitem';
import { AddSubcontractor } from './component/add-subcontractor/add-subcontractor';
import { ViewProjects } from './component/projects/view-projects/view-projects';
import { SSOLogin } from './component/sso-login/sso-login';
import { MsalModule, MsalRedirectComponent, MsalService, MSAL_INSTANCE } from '@azure/msal-angular';
import { PublicClientApplication, InteractionType } from '@azure/msal-browser';
import { environment } from '../environments/environment';
import { HttpClientModule } from '@angular/common/http';

export function MSALInstanceFactory(): PublicClientApplication {
  return (window as any).msalInstance; // ✅ Use the initialized instance from main.ts
}

@NgModule({
  declarations: [
    App,
    ProjectList,
    ProjectDetails,
    RfqAdd,
    Workitems,
    Subcontractor,
    Header,
    Footer,
    Rfq,
    AddWorkitem,
    AddSubcontractor,
    ViewProjects, 

  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
            HttpClientModule,
 SSOLogin,

    ReactiveFormsModule,
   MsalModule.forRoot(
      MSALInstanceFactory(), 
      null as any,
      null as any
    ),

   
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    {
      provide: MSAL_INSTANCE,
      useFactory: MSALInstanceFactory
    },
    MsalService

  ],
  bootstrap: [App]
})
export class AppModule { }
