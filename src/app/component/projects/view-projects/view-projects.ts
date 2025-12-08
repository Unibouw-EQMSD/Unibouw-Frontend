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
  date: string;
  rfqId: string;
  rfqNumber:string;
  responded: boolean;
  interested: boolean;
  viewed: boolean;
  maybeLater:boolean;
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
  reminderTime: string = ''
  reminderEmailBody: string = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  
  workItems: WorkItem[] = [];

  constructor(private rfqService:RfqService,private router:Router,private rfqResponseService: RfqResponseService, private cdr: ChangeDetectorRef, private snackBar: MatSnackBar, private route: ActivatedRoute,private projectService: projectService, private reminderService: ReminderService){
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

}

startAutoReminderWatcher() {
  setInterval(() => {
    this.checkAndTriggerReminder();
  }, 60000); // check every 60 seconds
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

  /* -------------------------------------- */
  /* 1️⃣ WORK-ITEM GROUPED API              */
  /* -------------------------------------- */
  this.rfqResponseService.getResponsesByProjectId(projectId).subscribe({
    
    next: (res: any[]) => {
       
       this.workItems = res.map(w => ({
        workItemId: w.workItemId,
        name: w.workItemName,
        requestsSent: w.subcontractors.length,
        notResponded: w.subcontractors.filter((s: any) => !s.responded).length,
        interested: w.subcontractors.filter((s: any) => s.interested).length,
        notInterested: w.subcontractors.filter((s: any) => s.responded && !s.interested).length,
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
          name: s.name,
          rating: s.rating || 0,
          date: s.date || '—',
          responded: s.responded,
          interested: s.interested,
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
    error: err => console.error("Error loading work item responses", err)
  });

  /* -------------------------------------- */
  /*  SUBCONTRACTOR GROUPED API          */
  /* -------------------------------------- */
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
          rfqNumber: item.rfqNumber,
          date: item.date,
          responded: item.responded,
          interested: item.interested,
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
        group.notInterested = group.workItems.filter((w: any) => w.responded && !w.interested).length;
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
    error: err => console.error("Error loading subcontractor responses", err)
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
      // Optionally revert UI if you want strict consistency:
      // rfq.maybeLater = false;
      // if (!wasViewed) rfq.viewed = false;
      // this.refreshWorkItemCounts(work);
      // this.cdr.detectChanges();
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
      // this.markViewed(work, rfq);   
      // this.markMaybeLater(work,rfq)
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

showReminderPopup = false;
    
// openReminderPopup(rfq: any) {
//   this.reminderService.getGlobalReminderConfig().subscribe({
//     next: (res) => {
//       const config = Array.isArray(res) && res.length > 0 ? res[0] : null;
//       if (!config) {
//         this.snackBar.open("No reminder configuration found", "Close", { duration: 3000 });
//         return;
//       }

//       this.GlobalReminderConfig = JSON.parse(JSON.stringify(config));
//       this.selectedRfqId = rfq.rfqId;

//       this.dueDate = rfq.dueDate;

//       // Generate reminder dates
//         const today = new Date();
//         const dueDate = new Date(rfq.dueDate);

//         const sequenceArray = config.reminderSequence
//           .split(',')
//           .map((x:any) => parseInt(x.trim(), 10))    // convert to numbers
//           .sort((a:any, b:any) => b - a);              // sort from highest to lowest (e.g., -1, -3, -5...)

//         this.reminderDates = sequenceArray
//           .map((seq:any) => {
//             const reminderDate = new Date(dueDate);
//             reminderDate.setDate(dueDate.getDate() + seq); // seq is negative
//             return reminderDate;
//           })
//           .filter((date:any) => date >= today) // ensure only future dates
//           .map((date:any) => date.toISOString().split("T")[0]); // final string format YYYY-MM-DD


//       this.reminderTime = config.reminderTime || "08:00";
//       this.reminderEmailBody = config.reminderEmailBody || "";

//       this.showReminderPopup = true;
//     },
//     error: () => {
//       this.snackBar.open("Failed to load reminder settings", "Close", { duration: 3000 });
//     }
//   });
// }

// openReminderPopup(rfq: any) {
//   this.reminderService.getGlobalReminderConfig().subscribe({
//     next: (res) => {
//       const config = Array.isArray(res) && res.length > 0 ? res[0] : null;
//       if (!config) {
//         this.snackBar.open("No reminder configuration found", "Close", { duration: 3000 });
//         return;
//       }

//       this.GlobalReminderConfig = JSON.parse(JSON.stringify(config));
//       this.selectedRfqId = rfq.rfqId;
//       this.dueDate = rfq.dueDate;

//       // Helper to normalize date to local midnight
//       const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

//       const today = atMidnight(new Date());
//       const dueDate = new Date(rfq.dueDate);

//       if (isNaN(dueDate.getTime())) {
//         this.snackBar.open("Invalid due date", "Close", { duration: 3000 });
//         return;
//       }

//       // Generate reminder dates
//       const sequenceArray = config.reminderSequence
//         .split(',')
//         .map((x: any) => parseInt(x.trim(), 10))
//         .filter((n:any) => !isNaN(n))
//         .sort((a: any, b: any) => b - a); // highest to lowest (-1, -3, ...)

//       this.reminderDates = sequenceArray
//         .map((seq: number) => {
//           const reminderDate = new Date(dueDate);
//           reminderDate.setDate(reminderDate.getDate() + seq);
//           return atMidnight(reminderDate); // normalize
//         })
//         .filter((date:any) => date.getTime() >= today.getTime()) // only future or today
//         .map((date:any) => date.toISOString().split("T")[0]); // YYYY-MM-DD

//       this.reminderTime = config.reminderTime || "08:00";
//       this.reminderEmailBody = config.reminderEmailBody || "";

//       this.showReminderPopup = true;
//     },
//     error: () => {
//       this.snackBar.open("Failed to load reminder settings", "Close", { duration: 3000 });
//     }
//   });
// }

customReminderDates: Date[] = [];

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

      // Helper: normalize to local midnight
      const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

      // Robust parser for various input formats (Date, ISO, dd-mm-yyyy, dd/mm/yyyy, timestamp)
      const parseDate = (input: any): Date | null => {
        if (!input && input !== 0) return null;

        // If already a Date
        if (input instanceof Date) {
          return isNaN(input.getTime()) ? null : input;
        }

        // If numeric timestamp
        if (typeof input === 'number') {
          const dt = new Date(input);
          return isNaN(dt.getTime()) ? null : dt;
        }

        // If string - try ISO first (YYYY-MM-DD or YYYY/MM/DD or full ISO)
        if (typeof input === 'string') {
          const trimmed = input.trim();

          // ISO-like (YYYY-MM-DD or YYYY/MM/DD)
          const isoMatch = trimmed.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/);
          if (isoMatch) {
            const dt = new Date(trimmed); // safe for YYYY-MM-DD
            if (!isNaN(dt.getTime())) return dt;
          }

          // dd-mm-yyyy or dd/mm/yyyy
          const dmyMatch = trimmed.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
          if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10) - 1;
            const year = parseInt(dmyMatch[3], 10);
            const dt = new Date(year, month, day);
            if (!isNaN(dt.getTime())) return dt;
          }

          // Attempt Date parse as last resort
          const dtFallback = new Date(trimmed);
          if (!isNaN(dtFallback.getTime())) return dtFallback;
        }

        // unknown format
        return null;
      };

      const dueDateObj = parseDate(rfq.dueDate);
      if (!dueDateObj) {
        this.snackBar.open("Invalid due date", "Close", { duration: 3000 });
        return;
      }

      this.dueDate = rfq.dueDate;

      const today = atMidnight(new Date());

      // support config.reminderSequence or config.sequence (string like "-1,-3,-5")
      const seqString = (config.reminderSequence ?? config.sequence ?? '').toString();

      const sequenceArray = seqString
        .split(',')
        .map((x: any) => parseInt((x ?? '').toString().trim(), 10))
        .filter((n: any) => !isNaN(n))
        .sort((a: any, b: any) => b - a); // descending (most negative first)

      const normalize = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()); // force midnight local

      const due = normalize(new Date(dueDateObj));
const now = normalize(new Date(today));

this.reminderDates = sequenceArray
  .map((seq: number) => {
    const reminderDate = new Date(due);   // already normalized
    reminderDate.setDate(reminderDate.getDate() + seq);
    return normalize(reminderDate);
  })
  .filter((date: Date) => date >= now)
  .sort((a:any, b:any) => a.getTime() - b.getTime())
  .map((d:any) => {
    // output in YYYY-MM-DD without timezone shift
    return d.toLocaleDateString("en-CA"); // → 2025-12-28 etc.
  });

// this.reminderDates = sequenceArray
//   .map((seq: number) => {
//     const reminderDate = new Date(due); // already normalized
//     reminderDate.setDate(reminderDate.getDate() + seq);
//     return normalize(reminderDate);
//   })
//   .filter((date: Date) => date >= now)
//   .sort((a: any, b: any) => a.getTime() - b.getTime())
//   .map((d: any) => {
//     // convert to DD-MM-YYYY
//     const day = String(d.getDate()).padStart(2, '0');
//     const month = String(d.getMonth() + 1).padStart(2, '0');
//     const year = d.getFullYear();
//     return `${day}-${month}-${year}`;
//   });

  this.customReminderDates = this.reminderDates.map(d => new Date(d));

      this.reminderTime = config.reminderTime || "08:00";
      this.reminderEmailBody = config.reminderEmailBody || "";

      this.showReminderPopup = true;
    },
    error: () => {
      this.snackBar.open("Failed to load reminder settings", "Close", { duration: 3000 });
    }
  });
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

  this.rfqResponseService.sendReminder(this.subId, this.selectedRfqId, this.reminderEmailBody)
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

editRfq(rfqId: string) {
    this.router.navigate(['/add-rfq', this.projectId, { rfqId: rfqId }]);
}

}

