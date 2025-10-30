import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, switchMap, from, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MsalService } from '@azure/msal-angular';
import { AppConfigService } from './app.config.service';



export interface Rfq {
  id?: string;
  customerName: string;
  sentDate: string;
  dueDate: string;
  rfqSent: number;
  quoteReceived: number;
  actions?: string[];
}
@Injectable({ providedIn: 'root' })

export class rfqService {
  apiURL: string = '';
  rfq: string = '';

  constructor(
    private http: HttpClient,
    private msalService: MsalService,
    private appConfigService: AppConfigService
  ) {
    this.apiURL = this.appConfigService.getConfig().apiURL;
    this.rfq = `${this.apiURL}/Rfq/byProject`;
  }

  /** 🧠 Generate Azure AD headers */
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

  /** ✅ Fetch all RFQs */
  getRfq(): Observable<Rfq[]> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ count: number; data: Rfq[] }>(this.rfq, { headers })
      ),
      map((res) =>
        (res.data || []).map((it) => ({
          customerName: it.customerName || '',
          sentDate: it.sentDate || '',
          dueDate: it.dueDate || '',
          rfqSent: it.rfqSent || 0,
          quoteReceived: it.quoteReceived || 0,
        }))
      )
    );
  }

  /** ✅ Fetch RFQs by projectId */
  getRfqByProjectId(projectId: string): Observable<Rfq[]> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ data: Rfq[] }>(`${this.rfq}/${projectId}`, { headers })
      ),
      map((res) => res.data || [])
    );
  }
}
