import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PublicClientApplication, AuthenticationResult } from '@azure/msal-browser';
import { AppConfigService } from '../../services/app.config.service';

interface MeResponse {
  name: string;
  email: string;
  roles: string;
  scopes?: string;
}

@Component({
  selector: 'app-sso-login',
  templateUrl: './sso-login.html',
  styleUrls: ['./sso-login.css'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class SSOLogin implements OnInit {
  loading = false;
  email: string = '';

  private msalInstance: PublicClientApplication;
  private apiURL: string = '';
  private getMeEndpoint: string = '';
  private redirectUri: string = '';
  private scopes: string[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private appConfigService: AppConfigService
  ) {
    this.msalInstance = (window as any).msalInstance;

    const config = this.appConfigService.getConfig();
    this.apiURL = config.apiURL;
    this.getMeEndpoint = config.getMeEndpoint || '/Users/me';
    this.redirectUri = config.redirectUri || `${window.location.origin}/`;
    this.scopes = config.scopes || ['user.read'];

    console.log('🧩 App config loaded:', config);
  }

  // ✅ single ngOnInit()
  async ngOnInit() {
    console.log('🔹 SSOLogin initialized');
this.loading = true;

     // Small delay to ensure routing/guards settle
  await new Promise((r) => setTimeout(r, 300));


    try {
      // Handle redirect result from Microsoft login
      const result = await this.msalInstance.handleRedirectPromise();

      if (result && result.account) {
        console.log('✅ Redirect login success:', result.account);
        this.msalInstance.setActiveAccount(result.account);
        await this.continueLoginFlow(result.account);
        localStorage.setItem('show_welcome', 'true'); // 👈 show later in home page
        return;
      }

      // 👇 If already logged in, go to home directly
    const activeAccount = this.msalInstance.getActiveAccount();
    if (activeAccount) {
      console.log('✅ Already logged in, redirecting to workitems');
      await this.router.navigate(['/workitems'], { replaceUrl: true });
      return;
    }

    const accounts = this.msalInstance.getAllAccounts();
    if (accounts.length === 1) {
      this.msalInstance.setActiveAccount(accounts[0]);
      await this.continueLoginFlow(accounts[0]);
      return;
    }

    console.log('🕓 No account found — stay on login page');
    } catch (error) {
      console.error('❌ Redirect handling failed:', error);
    } finally {
      this.loading = false;
    }
  }

  // ✅ Login button click handler
  async onSubmit(emailRef: any) {
    console.log('🔹 Login form submitted with email:', this.email);

    if (emailRef.invalid) {
      emailRef.control.markAsTouched();
      console.warn('⚠️ Email field invalid');
      return;
    }

    await this.msalInstance.loginRedirect({
      scopes: this.scopes,
      loginHint: this.email,
      redirectUri: this.redirectUri,
    });
  }

  // ✅ Common function for silent token + API call
  private async continueLoginFlow(account: any) {
    try {
      this.loading = true;
      console.log('🔁 continueLoginFlow() called for account:', account.username);

      const result: AuthenticationResult = await this.msalInstance.acquireTokenSilent({
        scopes: this.scopes,
        account,
      });

      console.log('✅ Token acquired silently');
      const token = result.accessToken;
      localStorage.setItem('access_token', token);

      console.log('🌐 Calling API:', `${this.apiURL}${this.getMeEndpoint}`);
      const me = await firstValueFrom(
        this.http.get<MeResponse>(`${this.apiURL}${this.getMeEndpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );

      console.log('✅ /Me/GetMe response:', me);

      localStorage.setItem('user_data', JSON.stringify(me));

      // ✅ Show welcome message only once per login
      // const userName = me.name || me.email.split('@')[0];
      // alert(`Welcome ${userName}! 👋`);

      console.log('📦 User data saved locally, redirecting...');
      await this.router.navigate(['/workitems'], { replaceUrl: true });
    } catch (error) {
      console.error('❌ continueLoginFlow failed:', error);
      alert('Login failed. Please try again.');
    } finally {
      this.loading = false;
    }
  }
}
