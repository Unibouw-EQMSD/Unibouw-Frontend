import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, switchMap, from, Observable } from 'rxjs';
import { MsalService } from '@azure/msal-angular';
import { AppConfigService } from './app.config.service';

export interface Workitem {
  workItemID: string;
  categoryID?: any;
  number: string;
  name: string;
  description: string;
  editItem?: boolean;
  isActive?: boolean;
  isEditing?: boolean;
  showSavedMsg?: boolean;
}

export interface WorkitemCategory {
  categoryID: string;
  categoryName: string;
}

@Injectable({ providedIn: 'root' })
export class WorkitemService {
  private apiURL: string = '';
  private categoryUrl: string = '';
  private workitemsByCategoryUrl: string = '';
  private workitemsUrl: string = '';

  constructor(
    private http: HttpClient,
    private msalService: MsalService,
    private appConfigService: AppConfigService
  ) {
    this.apiURL = this.appConfigService.getConfig().apiURL;
    this.categoryUrl = `${this.apiURL}/Common/workitemcategorytype`;
    this.workitemsByCategoryUrl = `${this.apiURL}/WorkItems/WorkItemByCategory`;
    this.workitemsUrl = `${this.apiURL}/WorkItems`;
  }

  /* Get Authorization Headers */
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

  /* Get all work item categories */
  getCategories(): Observable<WorkitemCategory[]> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ count: number; data: WorkitemCategory[] }>(this.categoryUrl, { headers })
      ),
      map((res) => res.data || [])
    );
  }

  /* Async version of getCategories */
  async getCategoriesAsync(): Promise<WorkitemCategory[]> {
    const headers = await this.getHeaders();
    const res = await this.http
      .get<{ count: number; data: WorkitemCategory[] }>(this.categoryUrl, {
        headers,
      })
      .toPromise();
    return res?.data || [];
  }

  /* Get work items by category ID */
  getWorkitems(categoryId: string): Observable<Workitem[]> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<{ count: number; data: Workitem[] }>(
          `${this.workitemsByCategoryUrl}/${categoryId}`,
          { headers }
        )
      ),
      map((res) =>
        (res.data || []).map((it) => ({
          workItemID: it.workItemID || '',
          number: it.number || '',
          name: it.name || '',
          description: it.description || '',
          isActive: it.isActive,
          editItem: false,
        }))
      )
    );
  }

  /* Update isActive status */
  updateIsActive(workitemId: string, isActive: boolean): Observable<any> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) =>
        this.http.post(`${this.workitemsUrl}/${workitemId}/${isActive}`, null, {
          headers,
        })
      )
    );
  }

  /* Update description text */
  updateDescription(workItemID: string, description: string): Observable<any> {
    return from(this.getHeaders()).pipe(
      switchMap((headers) => {
        const jsonHeaders = headers.set('Content-Type', 'application/json');
        return this.http.post(
          `${this.workitemsUrl}/${workItemID}/description`,
          JSON.stringify(description),
          { headers: jsonHeaders }
        );
      })
    );
  }
}
