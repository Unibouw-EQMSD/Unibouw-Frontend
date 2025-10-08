import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app.module';
import { PublicClientApplication } from '@azure/msal-browser';
import { environment } from './environments/environment';

async function initializeApp() {
  const msalInstance = new PublicClientApplication({
    auth: {
      clientId: environment.clientId,
      authority: `https://login.microsoftonline.com/${environment.tenantId}`,
      redirectUri: environment.redirectUri,
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: false
    }
  });


    await msalInstance.initialize();


  // Handle redirect response if coming from Microsoft login
  await msalInstance.handleRedirectPromise();

  (window as any).msalInstance = msalInstance;

  platformBrowser()
    .bootstrapModule(AppModule)
    .catch((err: any) => console.error(err));
}

initializeApp();
