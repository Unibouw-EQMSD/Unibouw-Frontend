import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app.module';
import { PublicClientApplication } from '@azure/msal-browser';
import { AppConfigService, AppConfig } from './app/services/app.config.service';

async function initializeApp() {
  // 🧩 Step 1: Load config.json using fetch (not HttpClient)
  const response = await fetch('assets/app.config.json');
  const config: AppConfig = await response.json();

  // 🧩 Step 2: Initialize MSAL with config values
  const msalInstance = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      redirectUri: config.redirectUri,
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: false,
    },
  });

  await msalInstance.initialize();

  // 🧩 Step 3: Handle redirect response
  await msalInstance.handleRedirectPromise();

  // 🧩 Step 4: Expose globally
  (window as any).msalInstance = msalInstance;
  (window as any).appConfig = config;

  // 🧩 Step 5: Bootstrap Angular app and provide config
  platformBrowser()
    .bootstrapModule(AppModule, {
      providers: [
        { provide: AppConfigService, useValue: { getConfig: () => config } },
      ],
    })
    .catch((err: any) => console.error(err));
}

initializeApp();
