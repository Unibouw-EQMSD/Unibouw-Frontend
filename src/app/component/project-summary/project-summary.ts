import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { projectService, projectdetails } from '../../services/project.service';
import { WorkitemService, Workitem } from '../../services/workitem.service';
import { CommonModule } from '@angular/common';
import { RfqResponseService } from '../../services/rfq-response.service';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeNl from '@angular/common/locales/nl';

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
  number!: string;
  isInterested = false;
  buttonsDisabled = false;
rfq: any;
  attachments!: FormArray<FormControl<File | null>>;
  // comments!: FormControl<string>;
  selectedFiles: (File | null)[] = [];
showQuotePanel = false;
hideRightSummaryCard = false;
rightSectionVisible = true;

isQuoteSubmitted = false;
quoteForm!: FormGroup;

  // Previous submissions
  previousSubmissions: {
    date: string | Date;
    amount: number;
    attachmentUrl: string;
    comment?: string;
  }[] = [];
  selectedComment: string = '';
  showCommentModal: boolean = false;
  formSubmitted: boolean = false;
  constructor(
    private route: ActivatedRoute,
    private rfqResponseService: RfqResponseService,
    private fb: FormBuilder,
    private http: HttpClient,

  ) {

    registerLocaleData(localeNl);

    this.attachments = this.fb.array<FormControl<File | null>>([
      this.fb.control<File | null>(null)
    ]);
  }
ngOnInit(): void {
  this.quoteForm = this.fb.group({
    quoteAmount: ['', Validators.required],
    comments: ['', Validators.required],
  });

  this.route.queryParams.subscribe(params => {
    this.rfqId = params['rfqId'];
    this.subId = params['subId'];
    this.number = params['number']; // RFQ number, not WorkItemID

    if (this.rfqId && this.subId) {
      // Restore previous state
      const stateKey = `rfq_state_${this.rfqId}_${this.subId}_${this.number}`;
      const savedState = localStorage.getItem(stateKey);
      if (savedState) {
        const state = JSON.parse(savedState);
        this.buttonsDisabled = state.buttonsDisabled ?? false;
        this.isInterested = state.isInterested ?? false;
        this.isQuoteSubmitted = state.isQuoteSubmitted ?? false;
        if (state.selectedFileNames?.length > 0) {
          this.selectedFiles = state.selectedFileNames.map((name: string) => ({ name } as File));
        }
      }

      // Load project first
      this.loadProjectSummary(this.rfqId);
      this.loadPreviousSubmissions();
    } else {
      this.isLoading = false;
      this.errorMsg = 'Missing required parameters (rfqId or subId).';
    }
  });
}

  

openQuotePanel() {
  this.showQuotePanel = true;
  this.rightSectionVisible = true;   // show right section when opening
}
  
loadProjectSummary(rfqId: string, workItemIds?: string[]) {
  this.isLoading = true;

  this.rfqResponseService.getProjectSummary(rfqId, workItemIds).subscribe({
    next: (res: any) => {
      this.isLoading = false;

      if (!res || !res.project) {
        this.errorMsg = "No data returned from server.";
        this.project = null;
        this.workItems = [];
        this.selectedWorkItem = null;
        return;
      }

      this.project = res.project;
      this.workItems = res.workItems || [];

      // auto-select first work item
      if (this.workItems.length > 0) {
        this.selectedWorkItem = this.workItems[0];
      }

      // ⚡️ Mark all work items as viewed
      this.workItems.forEach(wi => {
        if (this.rfqId && this.subId) {
          this.rfqResponseService.markAsViewed(this.rfqId, this.subId, wi.workItemID).subscribe();
        }
      });

      // Optional: check link validity
      if (typeof this.checkLinkValidity === "function") {
        this.checkLinkValidity();
      }
    },
    error: err => {
      this.isLoading = false;
      this.errorMsg = "Failed to load project summary.";
      console.error("Error loading project summary:", err);
    }
  });
}




  addMore() {
    this.attachments.push(this.fb.control(null));
  }

  onFileSelected(event: any) {
  const file = event.target.files[0];
  if (file) {
    this.selectedFiles = [file]; // store single file
  }
}

removeFile(inputRef: HTMLInputElement) {
  this.selectedFiles = []; // clear the array
  inputRef.value = '';      // clear the input
}

  submitQuoteFile() {


     this.formSubmitted = true; // 👈 enable error messages

  // Validate form fields
  if (this.quoteForm.invalid) {
    alert("Please fill all required fields.");
    return;
  }
    const file = this.selectedFiles[0];
    if (!file) return;

    const formValues = this.quoteForm.getRawValue();
    const totalAmount = Number(formValues.quoteAmount || 0);
    const comment = formValues.comments;

    const key = `rfq_prev_submissions_${this.rfqId}_${this.subId}`;
    const previous = JSON.parse(localStorage.getItem(key) || '[]');

    this.rfqResponseService.uploadQuoteFile(
      this.rfqId, this.subId, file, totalAmount, comment
    ).subscribe({
      next: () => {

        alert(this.isQuoteSubmitted ? 'Quote re-submitted!' : 'Quote submitted!');

        // ⭐ Mark submitted
        this.isQuoteSubmitted = true;

        const newSubmission = {
          date: new Date().toISOString(),
          amount: totalAmount,
          attachmentUrl: URL.createObjectURL(file),
          fileName: file.name,
          comment: comment
        };

        previous.unshift(newSubmission);
        localStorage.setItem(key, JSON.stringify(previous));
    this.isQuoteSubmitted = true;
    
    // Keep summary hidden after submit
  this.rightSectionVisible = false;
    this.hideRightSummaryCard = true;
          this.previousSubmissions.unshift(newSubmission);

        // ⭐ Reset form & file
        this.selectedFiles = [];
        this.quoteForm.reset();
      }
    });
  }


openCommentModal(comment: string | null | undefined) {
  this.selectedComment = comment ?? "No comments available.";
  this.showCommentModal = true;
}

closeCommentModal() {
  this.showCommentModal = false;
  this.selectedComment = "";
}

downloadSubmission(submission: any) {
  if (!submission?.attachmentUrl) {
    alert("No file available to download.");
    return;
  }

  // Create a hidden download link
  const link = document.createElement('a');
  link.href = submission.attachmentUrl;
  link.download = submission.fileName || 'Quote.pdf';   // fallback filename
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}



  //  submitQuote() {
  //   if (!this.selectedWorkItem) return;
  //   const key = `rfq_state_${this.rfqId}_${this.subId}_${this.selectedWorkItem.workItemID}`;
  //   const saved = JSON.parse(localStorage.getItem(key) || '{}');

  //   const fileControl = this.attachments.at(0);
  //   const file = fileControl?.value;
  //   if (!file) {
  //     alert('Please select a file to upload.');
  //     return;
  //   }

  //   const amount = this.quoteForm.get('quoteAmount')?.value;
  //   const comment = this.quoteForm.get('comments')?.value;

  //   this.rfqResponseService.uploadQuoteFile(this.rfqId, this.subId, file)
  //     .subscribe({
  //       next: () => {
  //         alert('Quote uploaded successfully!');
  //         this.isQuoteSubmitted = true;
  //         saved.isQuoteSubmitted = true;
  //         saved.selectedFileNames = this.attachments.controls.map(f => f.value?.name);
  //         localStorage.setItem(key, JSON.stringify(saved));
  //       },
  //       error: () => {
  //         alert('Failed to upload quote.');
  //       }
  //     });
  // }

loadPreviousSubmissions() {
  this.rfqResponseService.getPreviousSubmissions(this.rfqId, this.subId)
    .subscribe({
      next: (res: any[]) => {

        // Load backend rows
        const backendData = res.map(r => ({
          date: r.uploadedOn,
          amount: r.totalQuoteAmount,
          attachmentUrl: r.attachmentUrl || null,
          comment: r.comment
        }));

        // Load stored file URLs from localStorage
        const key = `rfq_prev_submissions_${this.rfqId}_${this.subId}`;
        const localData = JSON.parse(localStorage.getItem(key) || '[]');

        this.previousSubmissions = [...backendData, ...localData];
      },
      error: () => console.warn("Failed to load previous submissions.")
    });
}

  submitInterest(status: string) {
    if (!this.selectedWorkItem) return;

    const key = `rfq_state_${this.rfqId}_${this.subId}_${this.selectedWorkItem.workItemID}`;
    const saved = JSON.parse(localStorage.getItem(key) || '{}');

    // mark viewed in backend
    this.rfqResponseService
      .markAsViewed(this.rfqId, this.subId, this.selectedWorkItem.workItemID)
      .subscribe();

    // button disable only for Interested
    this.buttonsDisabled = status === 'Interested';

    this.rfqResponseService
      .submitRfqResponse(
        this.rfqId,
        this.subId,
        this.selectedWorkItem.workItemID,
        status
      )
      .subscribe({
        next: res => {
          alert(`Your response "${status}" was recorded successfully!`);

          this.isInterested = status === 'Interested';
          this.selectedWorkItem.viewed = true;

          // 🔥 Save state to localStorage
          saved.status = status;
          saved.viewed = true;
          saved.isInterested = this.isInterested;
          saved.buttonsDisabled = this.buttonsDisabled;

          localStorage.setItem(key, JSON.stringify(saved));
        },
        error: err => {
          alert('Failed to submit response.');
          if (status === 'Interested') {
            this.buttonsDisabled = false;
          }
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

checkLinkValidity() {
  if (!this.rfq) {
    console.warn("RFQ not loaded yet.");
    return;
  }

  const now = new Date();
  const dueDate = new Date(this.rfq.globalDueDate || this.rfq.dueDate);

  console.log("Checking validity:", dueDate);

  if (now > dueDate) {
    this.buttonsDisabled = true;
    alert("This RFQ link has expired. You can no longer respond.");
  }
}

}