import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, switchMap, from, Observable } from 'rxjs';
import { MsalService } from '@azure/msal-angular';
import { AppConfigService } from './app.config.service';

export interface Subcontractors {
  id: string;
  name: string;
  category: string;
  personName: string;
  phoneNumber1: string;
  emailID: string;
  isActive?: boolean;
  editItem?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SubcontractorService {
  private apiURL: string = '';
  private subcontractorUrl: string = '';
  private subcontractorWorkitemUrl: string = '';

  constructor(
    private http: HttpClient,
    private msalService: MsalService,
    private appConfigService: AppConfigService
  ) {
    this.apiURL = this.appConfigService.getConfig().apiURL;
    this.subcontractorUrl = `${this.apiURL}/Subcontractor`;
    this.subcontractorWorkitemUrl = `${this.apiURL}/Common/subcontractorworkitemmapping`;
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

  /** 📋 Get all subcontractors */
  getSubcontractors(): Observable<Subcontractors[]> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ count: number; data: Subcontractors[] }>(
          this.subcontractorUrl,
          { headers }
        )
      ),
      map((res) =>
        (res.data || []).map((it) => ({
          id: it.id,
          name: it.name || '',
          category: it.category || '',
          personName: it.personName || '',
          phoneNumber1: it.phoneNumber1 || '',
          emailID: it.emailID || '',
          isActive: it.isActive,
          editItem: false,
        }))
      )
    );
  }

  /** 🧩 Get Work Items mapped to Subcontractors */
  getSubcontractorWorkItemMappings(): Observable<any[]> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ count: number; data: any[] }>(
          this.subcontractorWorkitemUrl,
          { headers }
        )
      ),
      map((res) => res.data || [])
    );
  }

  /** ➕ Create a new subcontractor */
  createSubcontractor(payload: any): Observable<any> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post(this.subcontractorUrl, payload, { headers })
      )
    );
  }

  /** 🔄 Update IsActive status */
  updateIsActive(subcontractorId: string, isActive: boolean): Observable<any> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.put(
          `${this.subcontractorUrl}/${subcontractorId}/${isActive}`,
          null,
          { headers }
        )
      )
    );
  }
}
