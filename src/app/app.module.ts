import { APP_INITIALIZER, NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
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
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Rfq } from './component/projects/rfq/rfq';
import { AddWorkitem } from './component/add-workitem/add-workitem';
import { AddSubcontractor } from './component/add-subcontractor/add-subcontractor';
import { ViewProjects } from './component/projects/view-projects/view-projects';
import { SSOLogin } from './component/sso-login/sso-login';

import { HttpClientModule } from '@angular/common/http';

// MSAL (Azure AD)
import { MsalModule, MsalService, MSAL_INSTANCE } from '@azure/msal-angular';
import { PublicClientApplication } from '@azure/msal-browser';

// Angular Material modules
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgxIntlTelInputModule } from 'ngx-intl-tel-input';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'; // ✅ ADD THIS
import { AppConfigService } from './services/app.config.service';

export function MSALInstanceFactory(): PublicClientApplication {
  return (window as any).msalInstance;
}
export function initConfig(appConfig: AppConfigService) {
  return () => appConfig.loadConfig();
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
    CommonModule,
    RouterModule,
     BrowserAnimationsModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    SSOLogin,
  NgxIntlTelInputModule,

    // Material
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatProgressSpinnerModule,
MatTooltipModule,
    // MSAL
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
    {
            provide: APP_INITIALIZER,
            useFactory: initConfig,
            deps: [AppConfigService],
            multi: true,
    },
    MsalService
  ],
  bootstrap: [App]
})
export class AppModule { }
