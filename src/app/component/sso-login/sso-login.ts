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
  imports: [CommonModule, FormsModule]
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
    this.redirectUri = config.redirectUri || `${window.location.origin}/login`;
    this.scopes = config.scopes || ['user.read'];

    console.log('🧩 App config loaded:', config);
  }

  async ngOnInit() {
    console.log('🔹 SSOLogin initialized');

    const activeAccount = this.msalInstance.getActiveAccount();
    console.log('👤 Active account on init:', activeAccount);

    if (activeAccount) {
      console.log('➡️ Continuing login flow for active account:', activeAccount.username);
      this.loading = true;
      try {
        await this.continueLoginFlow(activeAccount);
      } catch (e) {
        console.error('❌ Continue login flow failed:', e);
      } finally {
        this.loading = false;
      }
      return;
    }

    const res = await this.msalInstance.handleRedirectPromise().catch(err => {
      console.error('🚨 MSAL handleRedirectPromise error:', err);
      return null;
    });

    if (res?.account) {
      console.log('✅ Redirect login successful:', res.account);
      this.msalInstance.setActiveAccount(res.account);
    } else {
      const accounts = this.msalInstance.getAllAccounts();
      console.log('📦 Available accounts after redirect:', accounts);
      if (accounts.length === 1) this.msalInstance.setActiveAccount(accounts[0]);
    }

    const accounts = this.msalInstance.getAllAccounts();
    if (accounts.length > 0 && this.router.url === '/login') {
      console.log('➡️ Found existing account, continuing login flow...');
      this.loading = true;
      try {
        await this.continueLoginFlow(accounts[0]);
      } catch (e) {
        console.error('❌ Continue login flow failed:', e);
      } finally {
        this.loading = false;
      }
    }
  }


  
  async onSubmit(emailRef: any) {
    console.log('🔹 Login form submitted with email:', this.email);

    if (emailRef.invalid) {
      emailRef.control.markAsTouched();
      console.warn('⚠️ Email field invalid');
      return;
    }

    this.loading = true;

    try {
      const accounts = this.msalInstance.getAllAccounts();
      console.log('📦 MSAL accounts found:', accounts);

      if (accounts.length === 0) {
        console.log('➡️ No account found, redirecting to Microsoft login...');
        await this.msalInstance.loginRedirect({
          scopes: this.scopes,
          loginHint: this.email,
          redirectUri: this.redirectUri
        });
        return;
      }

      console.log('🔑 Acquiring token silently...');
      const result = await this.msalInstance.acquireTokenSilent({
        scopes: this.scopes,
        account: accounts[0]
      });

      console.log('✅ Token acquired successfully');
      const token = result.accessToken;
      console.log('🔒 Token (partial):', token.substring(0, 20) + '...');

      console.log('🌐 Calling API:', `${this.apiURL}${this.getMeEndpoint}`);
      const me = await firstValueFrom(
        this.http.get<MeResponse>(`${this.apiURL}${this.getMeEndpoint}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      );

      console.log('✅ /Me/GetMe response:', me);

      if (me.email.toLowerCase() !== this.email.toLowerCase()) {
        console.warn('⚠️ Email mismatch between entered and Microsoft account');
        alert('This email is not associated with your Microsoft account.');
        this.loading = false;
        return;
      }

      localStorage.setItem('access_token', token);
      localStorage.setItem('user_data', JSON.stringify(me));

      console.log('📦 User data stored in localStorage');
      await this.router.navigate(['/workitems'], { replaceUrl: true });
      console.log('✅ Navigation to /workitems complete');
    } catch (err) {
      console.error('❌ Login failed:', err);
      alert('Login failed. Please try again.');
    } finally {
      this.loading = false;
    }
  }

  private async continueLoginFlow(account: any) {
    console.log('🔁 continueLoginFlow() called for account:', account.username);

    const result: AuthenticationResult = await this.msalInstance.acquireTokenSilent({
      scopes: this.scopes,
      account
    });

    console.log('✅ Token acquired silently');
    const token = result.accessToken;
    localStorage.setItem('access_token', token);

    console.log('🌐 Calling API:', `${this.apiURL}${this.getMeEndpoint}`);
    const me = await firstValueFrom(
      this.http.get<MeResponse>(`${this.apiURL}${this.getMeEndpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    );

    console.log('✅ /Me/GetMe response:', me);

    localStorage.setItem('user_data', JSON.stringify(me));
    console.log('📦 User data saved locally, redirecting...');
    await this.router.navigate(['/workitems'], { replaceUrl: true });
  }
}
