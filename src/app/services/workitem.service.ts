import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, switchMap, from, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MsalService } from '@azure/msal-angular';

export interface Workitem {
  id: string;
  categoryId?: any;
  number: string;
  name: string;
  description: string;
  editItem?: boolean;
    isActive?: boolean;
  isEditing?: boolean;
    showSavedMsg?: boolean;

    

}
export interface WorkitemCategory {
  categoryId: string;
  categoryName: string;
}
export interface isActive{
    id: string;
      isActive?: boolean;


}
@Injectable({ providedIn: 'root' })
export class WorkitemService {

  constructor(private http: HttpClient, private msalService: MsalService) {}


 private async getHeaders(): Promise<HttpHeaders> {
    const accounts = this.msalService.instance.getAllAccounts();
    if (!accounts.length) throw new Error('No MSAL account found');

    const result = await this.msalService.instance.acquireTokenSilent({
      account: accounts[0],
      scopes: ['api://96b6d570-73e9-4669-98d6-745f22f4acc0/Api.Read']
    });

    return new HttpHeaders({
      'Accept': '*/*',
      'Authorization': `Bearer ${result.accessToken}` 
    });
  }

  getCategories(): Observable<WorkitemCategory[]> {
  return from(this.getHeaders()).pipe(
    switchMap(headers =>
      this.http.get<{ count: number, data: WorkitemCategory[] }>(
        `${environment.apiUrl}${environment.getCategoryType}`, { headers }
      )
    ),
    map(res => res.data || [])
  );
}

  async getCategoriesAsync(): Promise<WorkitemCategory[]> {
    const headers = await this.getHeaders();
    const res = await this.http.get<{ count: number, data: WorkitemCategory[] }>(
      `${environment.apiUrl}${environment.getCategoryType}`, { headers }
    ).toPromise();
    return res?.data || [];
  }

getWorkitems(categoryId: string): Observable<Workitem[]> {
  return from(this.getHeaders()).pipe(
    switchMap(headers =>
      this.http.get<{ count: number; data: Workitem[] }>(
        `${environment.apiUrl}${environment.getWorkitemsByCategory}/${categoryId}`, { headers }
      )
    ),
    map(res => (res.data || []).map(it => ({
      id: it.id || '',
      number: it.number || '',
      name: it.name || '',
      description: it.description || '',
      isActive: it.isActive,
      editItem: false
    })))
  );
}

updateIsActive(workitemId: string, isActive: boolean): Observable<any> {
  return from(this.getHeaders()).pipe(
    switchMap(headers =>
      this.http.put(`${environment.apiUrl}${environment.getWorkitems}/${workitemId}/${isActive}`, null, { headers })
    )
  );
}
updateDescription(workitemId: string, description: string): Observable<any> {
  return from(this.getHeaders()).pipe(
    switchMap(headers => {
      const jsonHeaders = headers.set('Content-Type', 'application/json');
      return this.http.put(
        `${environment.apiUrl}/WorkItems/${workitemId}/description`,
        JSON.stringify(description), // raw string body
        { headers: jsonHeaders }
      );
    })
  );
}

}
