import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, switchMap, from, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MsalService } from '@azure/msal-angular';

export interface Subcontractors {
    id: string;
    name: string;
    category: string;
    contactPerson: string;
    emailId: string;
    isActive?: boolean;
    editItem?: boolean;
}
@Injectable({ providedIn: 'root' })
export class SubcontractorService {
    constructor(private http: HttpClient, private msalService: MsalService) { }

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

    getSubcontractors(): Observable<Subcontractors[]> {
        return from(this.getHeaders()).pipe(
            switchMap(headers =>
                this.http.get<{ count: number; data: Subcontractors[] }>(
                    `${environment.apiUrl}${environment.getSubcontractor}`, { headers }
                )
            ),
            map(res => (res.data || []).map(it => ({
                id: it.id,
                name: it.name || '',
                category: it.category || '',
                contactPerson: it.contactPerson || '',
                emailId: it.emailId || '',
                isActive: it.isActive,
                editItem: false
            })))
        )
    }

     createSubcontractor(payload: any): Observable<any> {
    return from(this.getHeaders()).pipe(
      switchMap(headers =>
        this.http.post(`${environment.apiUrl}${environment.postSubcontractor}`, payload, { headers })
      )
    );
  }

    updateIsActive(subcontractorId: string, isActive: boolean): Observable<any> {
  return from(this.getHeaders()).pipe(
    switchMap(headers =>
      this.http.put(`${environment.apiUrl}${environment.getSubcontractor}/${subcontractorId}/${isActive}`, null, { headers })
    )
  );
}

}