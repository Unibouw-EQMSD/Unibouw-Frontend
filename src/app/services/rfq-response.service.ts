import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AppConfigService } from './app.config.service';

@Injectable({
  providedIn: 'root'
})
export class RfqResponseService {
  private apiURL: string = '';

  constructor(
    private http: HttpClient,
    private appConfigService: AppConfigService
  ) {
    this.apiURL = this.appConfigService.getConfig().apiURL;
  }

  /**
   * ✅ Fetch Project Summary
   */
getProjectSummary(rfqId: string, workItemIds?: string[]) {
  const params = new URLSearchParams();
  params.append('rfqId', rfqId);
  if (workItemIds && workItemIds.length) {
    workItemIds.forEach(id => params.append('workItemIds', id));
  }

  return this.http.get(`${this.apiURL}/RfqResponse/GetProjectSummary?${params.toString()}`);
}

getResponsesByProjectId(projectId: string) {
  return this.http.get(`${this.apiURL}/RfqResponse/responses/project/${projectId}`);
}
  /**
   * ✅ Submit response without file
   */
  // submitRfqResponse(
  //   rfqId: string,
  //   subcontractorId: string,
  //   workItemId: string,
  //   status: string
  // ): Observable<any> {
  //   const formData = new FormData();
  //   formData.append('rfqId', rfqId);
  //   formData.append('subcontractorId', subcontractorId);
  //   formData.append('workItemId', workItemId);
  //   formData.append('status', status);

  //   return this.http.post(`${this.apiURL}/RfqResponse/submit`, formData);
  // }

  /**
   * ✅ Submit response with file (auto base64 conversion)
   */
 submitRfqResponseWithFile(
  rfqId: string,
  subcontractorId: string,
  workItemId: string,
  status: string,
  file?: File
): Observable<any> {
  const formData = new FormData();
  formData.append('rfqId', rfqId);
  formData.append('subcontractorId', subcontractorId);
  formData.append('workItemId', workItemId);
  formData.append('status', status);

  if (file) {
    // If backend expects actual File object
    formData.append('file', file, file.name);

    // If backend expects base64 string instead, uncomment below:
    /*
    const reader = new FileReader();
    return new Observable(observer => {
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        formData.append('fileBase64', base64String);
        formData.append('fileName', file.name);

        this.http.post(`${this.apiURL}/RfqResponse/submit`, formData).subscribe({
          next: res => {
            observer.next(res);
            observer.complete();
          },
          error: err => observer.error(err)
        });
      };
      reader.onerror = err => observer.error(err);
      reader.readAsDataURL(file);
    });
    */
  }

  // If no file or file appended directly
  return this.http.post(`${this.apiURL}/RfqResponse/submit`, formData);
}

submitRfqResponse(rfqId: string, subcontractorId: string, workItemId: string, status: string): Observable<any> {
  const formData = new FormData();
  formData.append('rfqId', rfqId);
  formData.append('subcontractorId', subcontractorId);
  formData.append('workItemId', workItemId);
  formData.append('status', status);

  return this.http.post(`${this.apiURL}/RfqResponse/submit`, formData);
}
  // ✅ Upload file (if you add this later)
uploadQuoteFile(rfqId: string, subId: string, file: File): Observable<any> {
  const formData = new FormData();
  formData.append('file', file); // only file in the form data

  // pass rfqId and subcontractorId in query params
  return this.http.post(
    `${this.apiURL}/RfqResponse/UploadQuote?rfqId=${rfqId}&subcontractorId=${subId}`,
    formData
  );


}

getQuoteAmount(rfqId: string, subId: string): Observable<any> {
  return this.http.get<any>(
    `${this.apiURL}/RfqResponse/GetQuoteAmount?rfqId=${rfqId}&subcontractorId=${subId}`
  );
}
markAsViewed(rfqId: string, subcontractorId: string, workItemId: string): Observable<any> {
  return this.http.post(
    `${this.apiURL}/RfqResponse/mark-viewed`,
    null, // no body
    {
      params: {
        rfqId: rfqId,
        subcontractorId: subcontractorId,
        workItemId: workItemId
      }
    }
  );
}

  downloadQuote(rfqId: string, subId: string): Observable<Blob> {
    return this.http.get(
      `${this.apiURL}/RfqResponse/DownloadQuote?rfqId=${rfqId}&subcontractorId=${subId}`,
      { responseType: 'blob' }
    );
  }
}