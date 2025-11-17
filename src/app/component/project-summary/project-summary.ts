import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { projectService, projectdetails } from '../../services/project.service';
import { WorkitemService, Workitem } from '../../services/workitem.service';
import { CommonModule } from '@angular/common';
import { RfqResponseService } from '../../services/rfq-response.service';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-project-summary',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], templateUrl: './project-summary.html',
  styleUrls: ['./project-summary.css']
})
export class ProjectSummary implements OnInit {
  project: any = null;
  subcontractor: any = null;
  workItems: any[] = [];
  isLoading = true;
  errorMsg = '';
  selectedWorkItem: any = null;
  rfqId!: string;
  subId!: string;
  workItemId!: string;
isInterested = false;
buttonsDisabled = false;

  attachments!: FormArray<FormControl<File | null>>;
  comments!: FormControl<string>;
  selectedFiles: (File | null)[] = [];

  constructor(
    private route: ActivatedRoute,
    private rfqResponseService: RfqResponseService,
    private fb: FormBuilder,
    private http: HttpClient,

  ) {
    this.attachments = this.fb.array<FormControl<File | null>>([
      this.fb.control<File | null>(null)
    ]);
    this.comments = this.fb.nonNullable.control('', {
      validators: [Validators.required]
    });
  }

 ngOnInit(): void {
  this.route.queryParams.subscribe(params => {
    this.rfqId = params['rfqId'];
    this.subId = params['subId'];
    this.workItemId = params['workItemId'];

    if (this.rfqId && this.subId) {

      // 👇 NEW — mark subcontractor as "viewed"
      if (this.workItemId) {
        this.rfqResponseService
          .markAsViewed(this.rfqId, this.subId, this.workItemId)
          .subscribe();
      }

      this.loadProjectSummary(this.rfqId);
    } else {
      this.isLoading = false;
      this.errorMsg = 'Missing required parameters (rfqId or subId).';
    }
  });
}

loadProjectSummary(rfqId: string, workItemIds?: string[]) {
  this.isLoading = true;

  this.rfqResponseService.getProjectSummary(rfqId, workItemIds).subscribe({
    next: (res: any) => {
      this.isLoading = false;

      // Use correct lowercase keys from API response
      if (res && res.project) {
        this.project = res.project;
        this.workItems = res.workItems || [];

        // Select the first work item by default
        this.selectedWorkItem = this.workItems[0] || null;
      } else {
        this.errorMsg = 'No data found for the given RFQ.';
        this.project = null;
        this.workItems = [];
        this.selectedWorkItem = null;
      }
    },
    error: err => {
      this.isLoading = false;
      this.errorMsg = 'Failed to load project summary.';
      console.error('Error loading project summary:', err);
    }
  });
}



  addMore() {
    this.attachments.push(this.fb.control(null));
  }

 onFileSelected(event: any) {
  const files: FileList = event.target.files;
  for (let i = 0; i < files.length; i++) {
    this.selectedFiles.push(files[i]);
  }
}

removeFile(index: number) {
  this.selectedFiles.splice(index, 1);
}

submitQuoteFile() {
  const file = this.selectedFiles[0];
  if (!file) return;

  this.rfqResponseService
    .uploadQuoteFile(this.rfqId, this.subId, file)
    .subscribe({
      next: res => {
        console.log('File uploaded successfully', res);
        alert('Quote uploaded successfully!');
      },
      error: err => {
        console.error('Error uploading file', err);
        alert('Failed to upload quote!');
      }
    });
}


submitInterest(status: string) {
  if (!this.selectedWorkItem) return;

  this.buttonsDisabled = true; // disable buttons immediately

  this.rfqResponseService
    .submitRfqResponse(
      this.rfqId,
      this.subId,
      this.selectedWorkItem.workItemID,
      status
    )
    .subscribe({
      next: res => {
        console.log('Response saved successfully', res);
        alert(`Your response "${status}" was recorded successfully!`);

        // show attachment section only if user clicked "Interested"
        if (status === 'Interested') {
          this.isInterested = true;
        } else {
          this.isInterested = false;
        }
      },
      error: err => {
        console.error('Error saving response', err);
        alert('Failed to submit response.');
        this.buttonsDisabled = false; // re-enable if failed
      }
    });
}


  statusClass(status?: string) {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s.includes('progress')) return 'in-progress';
    if (s.includes('delay')) return 'delayed';
    if (s.includes('cancel')) return 'cancelled';
    return 'in-progress';
  }

  
}