import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { RfqService,Rfq} from '../../../services/rfq.service';
import { ActivatedRoute } from '@angular/router';
import { projectdetails, projectService } from '../../../services/project.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDatepicker } from '@angular/material/datepicker';
import { RfqResponseService } from '../../../services/rfq-response.service';
import { Workitem } from '../../../services/workitem.service';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';


interface RfqResponse {
  name: string;
  rating: number;
  date: string;
  rfqId: string;
  responded: boolean;
  interested: boolean;
  viewed: boolean;
  quote: string;
  actions: string[];
  subcontractorId: string;   // << ADD THIS
  quoteAmount?: string;
dueDate: Date;

}

interface WorkItem {
  workItemId: string;   
  name: string;
  requestsSent: number;
  notResponded: number;
  interested: number;
  notInterested: number;
  viewed: number;
  open: boolean;
  searchText: string;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  currentStart: number;
  currentEnd: number;
  rfqs: RfqResponse[];
  
}

@Component({
  selector: 'app-view-projects',
  standalone: false,
  templateUrl: './view-projects.html',
  styleUrls: ['./view-projects.css']   // ✅ fixed
})

export class ViewProjects {
  projectId!: string;
  projectDetails: any;
    projectData?: projectdetails;
selectedFile!: File;
  rfqId!: string;
  subId!: string;
  dueDate!: Date;
  quoteAmount: string = '';
  groupBy = 'workItem';
  currentPage = 1;
  totalPages = 1;
  searchText = '';
  filteredItems: any[] = [];
  pagedItems: any[] = [];
pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100, 200];  selectedTab = 'response'; 
  rfqList: any[] = [];
selectedRfqId: string = '';
displayedColumns: string[] = [
   'workitem',
    'rfqSentDate',
    'dueDate',
    'totalSubcontractors'
  ];
  dataSource = new MatTableDataSource<any>([]);
 isLoading = false;
  rfqs: Rfq[] = []; // <-- Add this line

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  
 workItems: WorkItem[] = [];
 reminderDates: string[] = [];   


  constructor(private rfqService:RfqService,private router:Router,private rfqResponseService: RfqResponseService, private cdr: ChangeDetectorRef, private snackBar: MatSnackBar, private route: ActivatedRoute,private projectService: projectService){

  }


  ngOnInit(): void {
  // ✅ Capture the project ID from the route
  this.projectId = this.route.snapshot.paramMap.get('id') || '';
  console.log('📦 Captured Project ID:', this.projectId);

 this.projectId = this.route.snapshot.paramMap.get('id') || '';
  if (this.projectId) {
    this.loadRfqData();
    this.loadProjectDetails(this.projectId);
  }

  // 🔥 Start background reminder checker
  //this.startAutoReminderWatcher();
}


startAutoReminderWatcher() {
  setInterval(() => {
    this.checkAndTriggerReminder();
  }, 60000); // check every 60 seconds
}

checkAndTriggerReminder() {
  // if (!this.reminderDates || this.reminderDates.length === 0) return;

  // const today = new Date();
  // const todayStr = this.reminderFormatDate(today); // "dd-MM-yyyy"

  // // If today matches any reminder date → send reminder
  // if (this.reminderDates.includes(todayStr)) {
  //   console.log("🔥 Auto reminder triggered for:", todayStr);

  //   this.sendReminder();  // 🚀 Auto-trigger here
  // }
  this.sendReminder(); 
}



reminderType: string = 'default';

loadProjectDetails(id: string) {
  this.isLoading = true;
  this.projectService.getProjectById(id).subscribe({
    next: (res) => {
      this.projectDetails = res;
      this.isLoading = false;
      console.log('■ Project Details Loaded:', this.projectDetails);
    },
    error: (err) => {
      console.error('■ Error fetching project details:', err);
      this.isLoading = false;
    }
  });
}

loadRfqResponseSummary(projectId: string) {
  this.rfqResponseService.getResponsesByProjectId(projectId).subscribe({
    next: (res: any) => {
      console.log("📌 RFQ RESPONSES", res);

      this.workItems = res.map((w: any) => ({
        workItemId: w.workItemId,
        name: w.workItemName,

        requestsSent: w.subcontractors.length,
        notResponded: w.subcontractors.filter((s: any) => !s.responded).length,
        interested: w.subcontractors.filter((s: any) => s.interested).length,
        notInterested: w.subcontractors.filter((s: any) => !s.interested && s.responded).length,
        viewed: w.subcontractors.filter((s: any) => s.viewed).length,

        open: false,
        searchText: '',
        pageSize: 10,
        currentPage: 1,
        totalPages: 1,
        currentStart: 1,
        currentEnd: 1,

        rfqs: w.subcontractors.map((s: any) => ({
          subcontractorId: s.subcontractorId, // ✅ must exist
          rfqId: s.rfqId,                     // ✅ must exist
          name: s.name,
          rating: s.rating || 0,
          date: s.date || '—',
          responded: s.responded,
          interested: s.interested,
          viewed: s.viewed,
          quote: s.quote || '—',
          actions: ['pdf', 'chat'],
          quoteAmount: '-',                // initialize
          dueDate: s.dueDate
        }))
      }));

      // After mapping, load quote amounts for all RFQs
      this.workItems.forEach(work => {
        work.rfqs.forEach(rfq => this.loadQuoteAmount(rfq));
      });

    },
    error: (err: any) => {
      console.error("❌ Error loading responses", err);
      this.snackBar.open("No Records Found for this RFQ", "Close", { duration: 3000 });
    }
  });
}


 // In your component
    onDatepickerOpened() {
      document.body.style.overflow = 'hidden';
    }
    onDatepickerClosed() {
      document.body.style.overflow = '';
    }

markViewed(work: WorkItem, rfq: any) {

  // ❌ If already viewed, do nothing (prevents double counting)
  if (rfq.viewed) return;

  this.rfqResponseService.markAsViewed(
    rfq.rfqId,
    rfq.subcontractorId,
    work.workItemId
  ).subscribe({
    next: () => {

      // 🔥 Update this RFQ row
      rfq.viewed = true;

      // 🔥 Recalculate summary counts
      this.refreshWorkItemCounts(work);

      // 🔥 Force UI refresh
      this.cdr.detectChanges();
    },
    error: () => console.error("Failed to mark viewed")
  });
}

refreshWorkItemCounts(work: WorkItem) {
  work.requestsSent   = work.rfqs.length;
  work.notResponded   = work.rfqs.filter(r => !r.responded).length;
  work.interested     = work.rfqs.filter(r => r.interested).length;
  work.notInterested  = work.rfqs.filter(r => r.responded && !r.interested).length;

  // 🔥 Keep this ALWAYS correct
  work.viewed         = work.rfqs.filter(r => r.viewed).length;
}
triggerViewOnLoad() {
  if (!this.workItems?.length) return;

  this.workItems.forEach(work => {
    work.rfqs.forEach(rfq => {
      this.markViewed(work, rfq);   // 🔥 calling your existing method
    });
  });
}

loadRfqData(): void {
  this.isLoading = true;

  this.rfqService.getRfqByProjectId(this.projectId).subscribe({
    next: (res: any) => {
      const rfqs = Array.isArray(res) ? res : [res];
      this.rfqList = rfqs;

      if (rfqs.length > 0) {
        this.selectedRfqId = rfqs[0].rfqID;
        this.loadRfqResponseSummary(this.projectId);
      }

      // 🔥 Fetch workitem-info for each RFQ
      const infoRequests = rfqs.map(r => 
        this.rfqService.getWorkItemInfo(r.rfqID)
      );

      forkJoin(infoRequests).subscribe((infoResults: any[]) => {
        this.dataSource.data = rfqs.map((item, index) => {
          const info = infoResults[index] || {};

          return {
            id: item.rfqID,
            customer: item.customerName || '—',
            rfqSentDate: this.formatDate(item.sentDate),
            dueDate: this.formatDate(item.dueDate),
            rfqSent: item.rfqSent || 0,
            quoteReceived: item.quoteReceived || 0,
            quoteAmount: item.quoteAmount || '-',

            // 🔥 Use EXACT swagger response
            workItem: info.workItem || '-',
            subcontractorCount: info.subcontractorCount ?? 0
          };
        });

        this.isLoading = false;
      });
    },

    error: () => {
      this.dataSource.data = [];
      this.isLoading = false;
    }
  });
}

 formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB'); // dd/MM/yyyy
  }
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }

  onAction(action: string, element: Rfq) {
    if (action === 'View') {
      alert(`Viewing RFQ: ${element.customerName}`);
    } else if (action === 'Download') {
      alert(`Downloading RFQ: ${element.customerName}`);
    }
  }
goToPage(page: number) {
  if (page >= 1 && page <= this.totalPages) {
    this.currentPage = page;
    this.updatePagedItems();
  }
}

onPageSizeChange() {
  this.currentPage = 1; // reset to first page
  this.totalPages = Math.ceil(this.filteredItems.length / this.pageSize) || 1;
  
  if (this.currentPage > this.totalPages) {
    this.currentPage = this.totalPages;
  }

  this.updatePagedItems();
}
  getFilteredRfqs(work: WorkItem) {
    const term = (work.searchText || '').trim().toLowerCase();
    let list = work.rfqs;
    if (term) {
      list = list.filter(r =>
        `${r.name} ${r.rfqId} ${r.quote || ''}`.toLowerCase().includes(term)
      );
    }

    work.totalPages = Math.max(1, Math.ceil(list.length / (work.pageSize || 10)));
    if (!work.currentPage) work.currentPage = 1;
    if (work.currentPage > work.totalPages) work.currentPage = work.totalPages;

    const start = (work.currentPage - 1) * work.pageSize;
    const end = start + work.pageSize;
    work.currentStart = start + 1;
    work.currentEnd = Math.min(list.length, end);

    return list.slice(start, end);
  }

  updatePagedItems() {
    // If you want a flat paged list across all workItems
    const allRfqs = this.workItems.flatMap(w => w.rfqs);
    this.totalPages = Math.max(1, Math.ceil(allRfqs.length / this.pageSize));

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.pagedItems = allRfqs.slice(start, end);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagedItems();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagedItems();
    }
  }
enableEdit(item: any) {
  item.isEditingDueDate = true;
}

onDateChange(item: any, newDate: Date) {
  item.dueDate = newDate;
}

loadQuoteAmount(rfq: any) {
  if (!rfq.subcontractorId) {
    console.warn('⚠ Missing subcontractorId for RFQ:', rfq.rfqId);
    rfq.quoteAmount = '-';
    return;
  }

  this.rfqResponseService.getQuoteAmount(rfq.rfqId, rfq.subcontractorId)
    .subscribe({
      next: (res: any) => {
        rfq.quoteAmount = res.quoteAmount || '-';
        const index = this.dataSource.data.findIndex(d => d.id === rfq.rfqId);
        if (index >= 0) {
          this.dataSource.data[index].quoteAmount = rfq.quoteAmount;
          this.dataSource._updateChangeSubscription();
        }
      },
      error: (err) => {
        console.error('❌ Error fetching quote amount:', err);
        rfq.quoteAmount = '-';
      }
    });
}
downloadQuote(event: Event, rfqId: string, subcontractorId: string) {
  event.stopPropagation(); // << prevent triggering row click

  this.rfqResponseService.downloadQuote(rfqId, subcontractorId).subscribe({
    next: (blob: Blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // OPTIONAL: if your backend provides filename in headers, use it.
      a.download = `Quote_Document.pdf`;
      a.click();

      window.URL.revokeObjectURL(url);
    },
    error: (err) => {
      console.error("Download error:", err);
      alert("No file uploaded for this subcontractor.");
    }
  });
}


formatDateForApi(date: any): string {
  if (!date) return '';
  const d = new Date(date);
  const localISOTime = new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  ).toISOString();
  return localISOTime;
}

addRfq(){
  this.router.navigate(['/add-rfq', this.projectId]);
  console.log(this.projectId,'project id')

}



// Reminder Popup Logic

parseDDMMYYYY(dateStr: string): Date {
  const [day, month, year] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// private _reminderDates: string[] = [];

// get reminderDates1(): string[] {
//   return this._reminderDates;
// }

// set reminderDates1(dates: string[]) {
//   this._reminderDates = dates;

//   // Auto trigger ONLY when popup is open to avoid unwanted calls
//   if (this.showReminderPopup && dates && dates.length > 0) {
//     this.sendReminder();
//   }
// }

generateReminderDates(dueDateInput: any): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dueDate: Date;

  // If input is string in DD-MM-YYYY format
  if (typeof dueDateInput === 'string' && dueDateInput.includes('-')) {
    dueDate = this.parseDDMMYYYY(dueDateInput);
  } 
  else {
    dueDate = new Date(dueDateInput);
  }

  dueDate.setHours(0, 0, 0, 0);

  const diffMs = dueDate.getTime() - today.getTime();
  if (diffMs <= 0) return [];

  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const gap = diffDays / 3;

  const reminderDates: string[] = [];

  for (let i = 1; i <= 3; i++) {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + Math.round(gap * i));
    reminderDates.push(this.reminderFormatDate(nextDate));
  }

  return reminderDates;
}


// Format dd-MM-yyyy
reminderFormatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}


showReminderPopup = false;
openReminderPopup(rfq: any) {
    this.selectedRfqId = rfq.rfqId;
    this.dueDate = rfq.dueDate;   

    this.reminderDates = this.generateReminderDates(rfq.dueDate);

    this.subId = rfq.subcontractorId;
    this.showReminderPopup = true;
  }

closeReminderPopup() {
  this.showReminderPopup = false;
}

// sendReminder() {
//     if (!this.selectedRfqId || !this.subId) {
//       alert('Missing RFQ or Subcontractor information.');
//       return;
//     }
//     // Implement the API call to send a reminder here.
//     console.log("Reminder:", this.selectedRfqId, this.subId);
//     this.showReminderPopup = false;
//     this.snackBar.open("Reminder sent!", "Close", { duration: 2000 });
//   }

private _reminderDates: string[] = [];

get reminderDates1(): string[] {
  return this._reminderDates;
}

set reminderDates1(dates: string[]) {
  this._reminderDates = dates;

  if (this.showReminderPopup && dates && dates.length > 0) {
    
    // ⏳ Trigger after a delay (example 5 sec)
    setTimeout(() => {
      this.sendReminder();
    }, 60000);
  }
}


sendReminder() {
  this.selectedRfqId = "a65866a5-044c-406b-8716-46eb61ba3f35";
  this.subId = "aa9c34bd-8c52-4478-b95c-cbbad6d41116";

  if (!this.selectedRfqId || !this.subId) {
    alert('Missing RFQ or Subcontractor information.');
    return;
  }

  this.isLoading = true; // 🔥 Start loader

  this.rfqResponseService.sendReminder(this.subId, this.selectedRfqId)
    .subscribe({
      next: (result) => {
        if (result.success) {
          this.snackBar.open("Reminder sent!", "Close", { duration: 2000 });
        } else {
          this.snackBar.open("Reminder sending failed.", "Close", { duration: 2000 });
        }
      },
      error: (error) => {
        alert('Failed to send reminder: ' + (error?.error || error));
      },
      complete: () => {
        this.isLoading = false;   // 🔥 Stop loader
        this.showReminderPopup = false;     
      }
    });
}



}

