// user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MsalService } from '@azure/msal-angular';
import { AppConfigService } from './app.config.service';
import { BehaviorSubject, switchMap, from, Observable, firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiURL: string = '';
  private userSubject = new BehaviorSubject<any>(null);
  public user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    private msalService: MsalService,
    private appConfigService: AppConfigService
  ) {
    this.apiURL = this.appConfigService.getConfig().apiURL;
  }

  /** 🔐 Get Authorization Headers */
  private async getHeaders(): Promise<HttpHeaders> {
    const accounts = this.msalService.instance.getAllAccounts();
    if (!accounts.length) throw new Error('No MSAL account found');

    const result = await this.msalService.instance.acquireTokenSilent({
      account: accounts[0],
      scopes: ['api://96b6d570-73e9-4669-98d6-745f22f4acc0/Api.Read'],
    });

    return new HttpHeaders({
      Accept: '*/*',
      Authorization: `Bearer ${result.accessToken}`,
    });
  }

  setUser(user: any) {
    this.userSubject.next(user);
    // Store in localStorage
    localStorage.setItem('user_data', JSON.stringify(user));
  }

  getUser() {
    if (this.userSubject.value) return this.userSubject.value;

    const storedUser = localStorage.getItem('user_data');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.userSubject.next(user);
      return user;
    }
    return null;
  }
async fetchMe(): Promise<any> {
  const headers = await this.getHeaders();
  return await firstValueFrom(
    this.http.get<any>(`${this.apiURL}/Me/GetMe`, { headers })
  );
}
  getUserName(): string {
    const user = this.getUser();
    return user?.name || 'User';
  }

  getUserEmail(): string {
    const user = this.getUser();
    return user?.email || '';
  }

  getUserRoles(): string[] {
    const user = this.getUser();
    if (!user?.roles) return [];
    return typeof user.roles === 'string'
      ? user.roles.split(',').map((r: string) => r.trim())
      : user.roles;
  }

  isAdmin(): boolean {
    return this.getUserRoles().some((r) => r.toLowerCase() === 'admin');
  }

  clearUser() {
    this.userSubject.next(null);
    localStorage.removeItem('user_data');
  }

  /* send MsTeams Notification */
  sendMsTeamsNotification(message: string): Observable<any> {
    const body = { message };

    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post(`${this.apiURL}/MsTeamsNotification/ms-teams-notification`, body, {
          headers: headers.set('Content-Type', 'application/json'),
        })
      )
    );
  }
}
