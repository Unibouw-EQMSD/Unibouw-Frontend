import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, switchMap, from, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MsalService } from '@azure/msal-angular';
import { AppConfigService } from './app.config.service';

export interface projectdetails {
  projectID: string;
  number: string;
  name: string;
  customerName: string;
  customerID?: string;
  projectManagerName: string;
  startDate?: string;
  completionDate?: string;
  status: string;
  active?: boolean;
  editItem?: boolean;
}

@Injectable({ providedIn: 'root' })
export class projectService {
  apiURL: string = '';
  getprojectsurl: string = '';

  constructor(
    private http: HttpClient,
    private msalService: MsalService,
    private appConfigService: AppConfigService
  ) {
    this.apiURL = this.appConfigService.getConfig().apiURL;
    this.getprojectsurl = this.apiURL + '/Projects';
  }

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

  getProjectById(id: string): Observable<projectdetails> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ data: projectdetails }>(`${this.getprojectsurl}/${id}`, { headers })
      ),
      map((res) => res.data) // ✅ extract data before returning
    );
  }

  getProjects(): Observable<projectdetails[]> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ count: number; data: projectdetails[] }>(
          this.getprojectsurl, // ✅ only use getprojectsurl
          { headers }
        )
      ),
      map((res) =>
        (res.data || []).map((it) => ({
          projectID: it.projectID,
          number: it.number || '',
          name: it.name || '',
          customerName: it.customerName || '',
          customerID: it.customerID || '',
          projectManagerName: it.projectManagerName || '',
          startDate: it.startDate || '',
          completionDate: it.completionDate || '',
          status: it.status,
          editItem: false,
        }))
      )
    );
  }
}
