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
  scopes: string;
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

  // ✅ Replace environment variables with config-based values
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

    // ✅ Load values from app-config.json (not environment)
    const config = this.appConfigService.getConfig();
    this.apiURL = config.apiURL;
    this.getMeEndpoint = config.getMeEndpoint || '/Users/me';
    this.redirectUri = config.redirectUri || `${window.location.origin}/login`;
    this.scopes = config.scopes || ['user.read'];
  }

  async ngOnInit() {
    const activeAccount = this.msalInstance.getActiveAccount();

    if (activeAccount) {
      if (this.router.url === '/login') {
        this.loading = true;
        try {
          await this.continueLoginFlow(activeAccount);
        } catch (e) {
          console.error('Continue login flow failed:', e);
        } finally {
          this.loading = false;
        }
      }
      return;
    }

    const res = await this.msalInstance.handleRedirectPromise().catch(err => {
      console.error('MSAL handleRedirectPromise error:', err);
      return null;
    });

    if (res?.account) {
      this.msalInstance.setActiveAccount(res.account);
    } else {
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length === 1) this.msalInstance.setActiveAccount(accounts[0]);
    }

    const accounts = this.msalInstance.getAllAccounts();
    if (accounts.length > 0 && this.router.url === '/login') {
      this.loading = true;
      try {
        await this.continueLoginFlow(accounts[0]);
      } catch (e) {
        console.error('Continue login flow failed:', e);
      } finally {
        this.loading = false;
      }
    }
  }

  async onSubmit(emailRef: any) {
    if (emailRef.invalid) {
      emailRef.control.markAsTouched();
      return;
    }

    this.loading = true;

    try {
      const accounts = this.msalInstance.getAllAccounts();

      if (accounts.length === 0) {
        await this.msalInstance.loginRedirect({
          scopes: this.scopes,
          loginHint: this.email,
          redirectUri: this.redirectUri
        });
        return;
      }

      const result = await this.msalInstance.acquireTokenSilent({
        scopes: this.scopes,
        account: accounts[0]
      });

      const token = result.accessToken;

      const me = await firstValueFrom(
        this.http.get<MeResponse>(`${this.apiURL}${this.getMeEndpoint}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      );

      if (me.email.toLowerCase() !== this.email.toLowerCase()) {
        alert('This email is not associated with your Microsoft account.');
        this.loading = false;
        return;
      }

      localStorage.setItem('access_token', token);
      localStorage.setItem('user_data', JSON.stringify(me));

      await this.router.navigate(['/workitems'], { replaceUrl: true });
    } catch (err) {
      console.error('Login failed:', err);
      alert('Login failed. Please try again.');
    } finally {
      this.loading = false;
    }
  }

  private async continueLoginFlow(account: any) {
    const result: AuthenticationResult = await this.msalInstance.acquireTokenSilent({
      scopes: this.scopes,
      account
    });

    const token = result.accessToken;
    localStorage.setItem('access_token', token);

    const me = await firstValueFrom(
      this.http.get<MeResponse>(`${this.apiURL}${this.getMeEndpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    );

    localStorage.setItem('user_data', JSON.stringify(me));
    await this.router.navigate(['/workitems'], { replaceUrl: true });
  }
}
