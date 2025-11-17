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
}

interface WorkItem {
    workItemID: string;

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
   
    'rfqSentDate',
    'dueDate',
    'rfqSent',
    'quoteRecieved',
  ];
  dataSource = new MatTableDataSource<any>([]);
 isLoading = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
 workItems: WorkItem[] = [];


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
}

loadProjectDetails(id: string) {
  console.log('🚀 Calling API for project:', id);
  this.projectService.getProjectById(id).subscribe({
    next: (res) => {
      this.projectDetails = res;
      console.log('✅ Project Details Loaded:', this.projectDetails);
    },
    error: (err) => {
      console.error('❌ Error fetching project details:', err);
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

        // 🔥 Compute totals here
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
          subcontractorId: s.subcontractorId,
          name: s.name,
          rating: s.rating || 0,
          date: s.date || '—',
          rfqId: s.rfqId,                // backend returns real RFQ ID
          responded: s.responded,
          interested: s.interested,
          viewed: s.viewed,
          quote: s.quote || '—',
          actions: ['pdf', 'chat']
        }))
      }));
    },

    error: (err: any) => {
      console.error("❌ Error loading responses", err);
      this.snackBar.open("Unable to load RFQ responses", "Close", { duration: 3000 });
    }
  });
}


markViewed(work: WorkItem, rfq: any) {
  this.rfqResponseService.markAsViewed(
    rfq.rfqId,
    rfq.subcontractorId,
    work.workItemID
  ).subscribe();

  rfq.viewed = true;
}

loadRfqData(): void {
  this.isLoading = true;

  this.rfqService.getRfqByProjectId(this.projectId).subscribe({
    next: (res: any) => {
      const rfqs = Array.isArray(res) ? res : [res];
      this.rfqList = rfqs;

      if (rfqs.length > 0) {
        this.selectedRfqId = rfqs[0].rfqID;   // ⬅ Store RFQ ID
        console.log("📌 Selected RFQ ID:", this.selectedRfqId);

        this.loadRfqResponseSummary(this.projectId);
      }

      this.dataSource.data = rfqs.map((item: any) => ({
        id: item.rfqID,
        customer: item.customerName || '—',
        rfqSentDate: this.formatDate(item.sentDate),
        dueDate: item.dueDate ? new Date(item.dueDate) : null,
        rfqSent: item.rfqSent || 0,
        quoteReceived: item.quoteReceived || 0
      }));

      this.isLoading = false;
    },
    error: (err: any) => {
      console.error('❌ Failed to fetch RFQ:', err);
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

// saveDueDate(item: Rfq): void {
//   if (!item.id) {
//     console.error('❌ Missing RFQ ID for due date update:', item);
//     return;
//   }

//   const formattedDate = this.formatDateForApi(item.dueDate);

//   this.rfqService.updateDueDate(item.id, formattedDate).subscribe({
//     next: () => {
//       this.snackBar.open('✅ Due date updated successfully!', 'Close', { duration: 3000 });
//       item.isEditingDueDate = false;
//     },
//     error: (err: any) => {
//       console.error('❌ Failed to update due date:', err);
//       this.snackBar.open('❌ Failed to update due date.', 'Close', { duration: 3000 });
//     }
//   });
// }
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
}