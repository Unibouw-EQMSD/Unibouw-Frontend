import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { RfqService,Rfq} from '../../../services/rfq.service';
import { ActivatedRoute } from '@angular/router';
import { projectdetails, projectService } from '../../../services/project.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RfqResponseService } from '../../../services/rfq-response.service';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ReminderService } from '../../../services/reminder.service';

interface RfqResponse {
  name: string;
  rating: number;
  documentId: string;
  date: string;
  rfqId: string;
  rfqNumber:string;
  responded: boolean;
  interested: boolean;
  viewed: boolean;
  maybeLater:boolean;
  notInterested: number;
  quote: string;
  actions: string[];
  subcontractorId: string;   // << ADD THIS
  quoteAmount?: string;
  dueDate?: Date;
}

interface WorkItem {
  workItemId: string;   
  name: string;
  requestsSent: number;
  notResponded: number;
  interested: number;
  notInterested: number;
  viewed: number;
  maybeLater:number;
  open: boolean;
  searchText: string;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  currentStart: number;
  currentEnd: number;
  rfqs: RfqResponse[];
}

export const MY_FORMATS = {
  parse: {
    dateInput: 'DD-MM-YYYY',
  },
  display: {
    dateInput: 'DD-MM-YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'DD-MM-YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  selector: 'app-view-projects',
  standalone: false,
  templateUrl: './view-projects.html',
  styleUrls: ['./view-projects.css']
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
 subcontractorGroups: any[] = [];
displayedColumns: string[] = [
   'workitem',
    'rfqSentDate',
    'dueDate',
    'totalSubcontractors',
    'quoteRecieved',
    'status', 
  'actions'
  ];
  dataSource = new MatTableDataSource<any>([]);
 isLoading = false;
  rfqs: Rfq[] = []; // <-- Add this line
  duedate: Date | null = null;
  GlobalReminderConfig: any = null;
  reminderDates: string[] = [];  
  reminderTime: string = '';
  reminderEmailBody: string = '';
  minDate: Date = new Date();
  maxDate!: Date;


setMaxDueDate(due: Date | string) {
  if (typeof due === 'string') {
    // assume format is "DD-MM-YYYY"
    const [day, month, year] = due.split('-').map(Number);
    this.maxDate = new Date(year, month - 1, day);
  } else {
    // it's already a Date
    this.maxDate = new Date(due); // clone to avoid reference issues
  }
}


  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  
  workItems: WorkItem[] = [];

  constructor(private rfqService:RfqService,private router:Router,private rfqResponseService: RfqResponseService, private cdr: ChangeDetectorRef, private snackBar: MatSnackBar, private route: ActivatedRoute,private projectService: projectService, private reminderService: ReminderService){
  }

  ngOnInit(): void {
   
    this.route.queryParams.subscribe(params => {
    if (params['tab'] === 'rfq') {
      this.selectedTab = 'rfq';
      this.loadRfqData(); // reload table
    }
  });
  // ✅ Capture the project ID from the route
  this.projectId = this.route.snapshot.paramMap.get('id') || '';
  console.log('📦 Captured Project ID:', this.projectId);

 this.projectId = this.route.snapshot.paramMap.get('id') || '';
  if (this.projectId) {
    this.loadRfqData();
    this.loadProjectDetails(this.projectId);
  } 

}

startAutoReminderWatcher() {
  setInterval(() => {
    this.checkAndTriggerReminder();
  }, 60000); // check every 60 seconds
}
 ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }
checkAndTriggerReminder() {
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
this.isLoading = true;
 /* 1️⃣ WORK-ITEM GROUPED API              */
  this.rfqResponseService.getResponsesByProjectId(projectId).subscribe({
   
    next: (res: any[]) => {      
       this.workItems = res.map(w => ({
        workItemId: w.workItemId,
        name: w.workItemName,
        requestsSent: w.subcontractors.length,
        notResponded: w.subcontractors.filter((s: any) => !s.responded).length,
        interested: w.subcontractors.filter((s: any) => s.interested).length,
        notInterested: w.subcontractors.filter((s: any) => s.notInterested).length,
        viewed: w.subcontractors.filter((s: any) => s.viewed).length,
        maybeLater: w.subcontractors.filter((s: any) => s.maybeLater).length, // ✅ added
        open: false,
        searchText: '',
        pageSize: 10,
        currentPage: 1,
        totalPages: 1,
        currentStart: 1,
        currentEnd: 10,
        rfqs: w.subcontractors.map((s: any) => ({
          subcontractorId: s.subcontractorId,
          rfqId: s.rfqId,  
          workItemId: w.workItemId,   // 🔥 REQUIRED
          documentId: s.documentId,
          rfqNumber: w.rfqNumber,
          name: s.name,
          rating: s.rating || 0,
          date: s.date || '—',
          responded: s.responded,
          interested: s.interested,
  notInterested: s.notInterested,  // ⭐ FIXED
          viewed: s.viewed,
           maybeLater: s.maybeLater,
          quote: s.quote || '—',
          actions: ['pdf', 'chat'],
          quoteAmount: '-',                    // initialize      
          dueDate: s.dueDate          
        }))
      }));
 
      // load quote amounts
      this.workItems.forEach(work => {
        work.rfqs.forEach(rfq => this.loadQuoteAmount(rfq));
      });
      this.isLoading = false;
    },
    error: (err) => {
      console.error("Error loading work item responses", err)
      this.isLoading = false;
    }    
   
  });
 
  /*  SUBCONTRACTOR GROUPED API          */
  this.rfqResponseService.getResponsesByProjectSubcontractors(projectId).subscribe({
    next: (res: any[]) => {
      const grouped = res.reduce((acc: any[], item: any) => {
        let group = acc.find(g => g.subcontractorId === item.subcontractorId);
        if (!group) {
          group = {
            subcontractorId: item.subcontractorId,
            subcontractorName: item.subcontractorName,
            open: false,
            searchText: '',
            workItems: [],
            requestsSent: 0,
            notResponded: 0,
            interested: 0,
            notInterested: 0,
            viewed: 0,
            maybeLater: 0 // ✅ added
          };
          acc.push(group);
        }
 
        group.workItems.push({
          workItemId: item.workItemId,
          workItemName: item.workItemName,
          rfqId: item.rfqId,
          documentId: item.documentId,
          rfqNumber: item.rfqNumber,
          date: item.date,
          responded: item.responded,
          interested: item.interested,
          notInterested: item.notInterested,
 
          viewed: item.viewed,
          maybeLater: item.maybeLater, // ✅ added
          subcontractorId: item.subcontractorId,
          rating: 0,
          quoteAmount: "-",
          actions: ['pdf']
        });
 
        group.requestsSent = group.workItems.length;
        group.notResponded = group.workItems.filter((w: any) => !w.responded).length;
        group.interested = group.workItems.filter((w: any) => w.interested).length;
        group.notInterested = group.workItems.filter((w: any) => w.notInterested).length;
        group.viewed = group.workItems.filter((w: any) => w.viewed).length;
        group.maybeLater = group.workItems.filter((w: any) => w.maybeLater).length; // ✅ added
 
        return acc;
      }, []);
 
      this.subcontractorGroups = grouped;
 
      this.subcontractorGroups.forEach(sub => {
        sub.workItems.forEach((w: any) => this.loadQuoteAmount(w));
      });
this.isLoading = false;
    },
     error: (err) => {
      console.error("Error loading subcontractor responses", err);
      this.isLoading = false;
    }
   
  });
 
}
 

isBellEnabled(rfq: any): boolean {
  const amt = rfq.quoteAmount;

  // TRUE only when NO valid quote is submitted
  const noValidQuote =
    !amt || amt === "-" || isNaN(Number(amt));

  return (
    noValidQuote &&                // enable only if no quote uploaded
    !rfq.notInterested &&          // disable if Not Interested
    (rfq.viewed || rfq.interested || rfq.maybeLater)  // must have engagement
  );
}

isPdfEnabled(rfqs: any): boolean {
  const amt = rfqs.quoteAmount;

  // Disable when "-", empty, null, undefined, or not a number
  if (!amt || amt === "-" || isNaN(Number(amt))) {
    return false;
  }

  return true;
}

 // In your component
    onDatepickerOpened() {
      document.body.style.overflow = 'hidden';
    }
    onDatepickerClosed() {
      document.body.style.overflow = '';
    }

markViewed(rfq: any, parent: any) {
 
  if (rfq.viewed) return;
 
  this.rfqResponseService.markAsViewed(
    rfq.rfqId,
    rfq.subcontractorId,
    rfq.workItemId     // 🔥 correct source
  ).subscribe({
    next: () => {
 
      rfq.viewed = true;
 
      // Update parent summary ONLY if parent has workItems (subcontractor view)
      if (parent.workItems) {
        parent.viewed = parent.workItems.filter((w: any) => w.viewed).length;
      }
 
      this.cdr.detectChanges();
    },
    error: () => console.error("Failed to mark viewed")
  });
}
 

markMaybeLater(work: WorkItem, rfq: any) {
  // 1) Immediate local update so UI reflects change right away
  const wasViewed = !!rfq.viewed;
  rfq.maybeLater = true;
  rfq.interested = false;
  rfq.notInterested = false;

  // ensure viewed tick also shows
  if (!wasViewed) {
    rfq.viewed = true;
  }

  // Immediately refresh summary counts (so header numbers update)
  this.refreshWorkItemCounts(work);

  // Force change detection immediately (UI update)
  this.cdr.detectChanges();

  // 2) Persist the response on the server as "Maybe Later"
  // Use an API that accepts the status string (your backend expects status = "Maybe Later")
  // I assume you have a method like rfqResponseService.submitResponse(rfqId, subcontractorId, workItemId, status)
  this.rfqResponseService.submitRfqResponse(
    rfq.rfqId,
    rfq.subcontractorId,
    work.workItemId,
    'Maybe Later'   // important: persist "Maybe Later" not only "Viewed"
  ).subscribe({
    next: (res: any) => {
      // backend accepted — make sure counts are consistent (optional refresh)
      // Keep local UI as-is or optionally refresh from server
      this.refreshWorkItemCounts(work);
      this.cdr.detectChanges();
    },
    error: (err: any) => {
      console.error('Failed to save Maybe Later status', err);
      this.snackBar.open('Failed to mark Maybe Later. Try again.', 'Close', { duration: 3000 });
    }
  });
}

refreshWorkItemCounts(work: WorkItem) {
  work.requestsSent   = work.rfqs.length;
  work.notResponded   = work.rfqs.filter(r => !r.responded).length;
  work.interested     = work.rfqs.filter(r => r.interested).length;
  work.notInterested  = work.rfqs.filter(r => r.responded && !r.interested).length;

  work.viewed         = work.rfqs.filter(r => r.viewed).length;
  work.maybeLater     = work.rfqs.filter(r => r.maybeLater).length; // <--- add this
}
triggerViewOnLoad() {
  if (!this.workItems?.length) return;

  this.workItems.forEach(work => {
    work.rfqs.forEach(rfq => {
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
            subcontractorCount: info.subcontractorCount ?? 0,
            status: item.status || 'N/A' 
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

downloadQuote(event: Event, documentId: string) {
  event.stopPropagation();
 
  this.rfqResponseService.downloadQuote(documentId).subscribe({
    next: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "Quote.pdf";
      a.click();
      URL.revokeObjectURL(url);
    },
    error: (err) => {
      console.error("Download error:", err);
      alert("No file uploaded for this document.");
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

editRfq(rfqId: string) {
    this.router.navigate(['/add-rfq', this.projectId, { rfqId: rfqId }]);
}

private applyReminderConfig(dueDate: any, config: any) {

  // Helper normalize
  const normalize = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  // Robust date parser
  const parseDate = (input: any): Date | null => {
    if (!input && input !== 0) return null;

    if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

    if (typeof input === "number") {
      const d = new Date(input);
      return isNaN(d.getTime()) ? null : d;
    }

    if (typeof input === "string") {
      const trimmed = input.trim();

      // ISO YYYY-MM-DD
      const iso = trimmed.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/);
      if (iso) {
        const dt = new Date(trimmed);
        if (!isNaN(dt.getTime())) return dt;
      }

      // dd-mm-yyyy
      const dmy = trimmed.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
      if (dmy) {
        const day = +dmy[1];
        const month = +dmy[2] - 1;
        const year = +dmy[3];
        const dt = new Date(year, month, day);
        if (!isNaN(dt.getTime())) return dt;
      }

      const fallback = new Date(trimmed);
      if (!isNaN(fallback.getTime())) return fallback;
    }

    return null;
  };

  // Parse due date
  const dueObj = parseDate(dueDate);
  if (!dueObj) return false;

  const due = normalize(dueObj);
  const today = normalize(new Date());

  // Extract sequence
  const seqString = (config.reminderSequence ?? config.sequence ?? "").toString();

  const sequenceArray = seqString
    .split(",")
    .map((x:any) => parseInt((x || "").toString().trim(), 10))
    .filter((n:any) => !isNaN(n))
    .sort((a:any, b:any) => b - a);

  // Build reminder dates
  this.reminderDates = sequenceArray
    .map((seq:any) => {
      const d = new Date(due);
      d.setDate(d.getDate() + seq);
      return normalize(d);
    })
    .filter((d:any) => d >= today)
    .sort((a:any, b:any) => a.getTime() - b.getTime())
    .map((d:any) => d.toLocaleDateString("en-CA"));

  // Custom dates start same as default
  this.customReminderDates = this.reminderDates.map((d) => new Date(d));

  // Restore time & email body
  this.reminderTime = config.reminderTime || "08:00";
  this.reminderEmailBody = config.reminderEmailBody || "";

  return true;
}

showReminderPopup = false;
customReminderDates: (Date | null)[] = [];


openReminderPopup(rfq: any) {
  this.reminderService.getGlobalReminderConfig().subscribe({
    next: (res) => {
      const config = Array.isArray(res) && res.length > 0 ? res[0] : null;
      if (!config) {
        this.snackBar.open("No reminder configuration found", "Close", { duration: 3000 });
        return;
      }

      this.GlobalReminderConfig = JSON.parse(JSON.stringify(config));
      this.selectedRfqId = rfq.rfqId;
      this.subId = rfq.subcontractorId;

      this.dueDate = rfq.dueDate;

      const ok = this.applyReminderConfig(this.dueDate, this.GlobalReminderConfig);
      if (!ok) {
        this.snackBar.open("Invalid due date", "Close", { duration: 3000 });
        return;
      }

      this.setMaxDueDate(this.dueDate);
      this.reminderType = "default";
      this.showReminderPopup = true;
    }
  });
}

resetReminderPopup() {
  if (!this.GlobalReminderConfig || !this.dueDate) return;

  // this.reminderType = "default";
  this.applyReminderConfig(this.dueDate, this.GlobalReminderConfig);
}


closeReminderPopup() {
  this.showReminderPopup = false;
}

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
  if (!this.selectedRfqId || !this.subId) {
    alert('Missing RFQ or Subcontractor information.');
    return;
  }

  this.isLoading = true; // 🔥 Start loader

  this.rfqResponseService.sendReminder(this.subId, this.selectedRfqId, this.reminderEmailBody)
    .subscribe({
      next: (result) => {
        if (result.success) {
          this.snackBar.open("Reminder sent.", "Close", { duration: 2000 });
          alert("Reminder sent.");
        } else {
          this.snackBar.open("Reminder sending failed.", "Close", { duration: 2000 });
          alert("Reminder sending failed.");
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


// Remove a custom reminder date
removeCustomDate(index: number) {
  if (this.customReminderDates.length === 1) {
    this.snackBar.open('At least one reminder date is required', 'Close', {
      duration: 2000
    });
    return;
  }

  this.customReminderDates.splice(index, 1);
}

// Add a new custom reminder date
addCustomDate() {
  // const lastDate = 
  //   this.customReminderDates[this.customReminderDates.length - 1];

  // Default next date = +1 day from last selected date
  //const newDate = 
  // lastDate ? new Date(lastDate) : new Date();
  // newDate.setDate(newDate.getDate() + 1);

  // Respect max date (due date)
  // if (this.maxDate && newDate > this.maxDate) {
  //   this.snackBar.open('Date cannot exceed due date', 'Close', {
  //     duration: 2000
  //   });
  //   return;
  // }

  this.customReminderDates.push(null);
}


}

