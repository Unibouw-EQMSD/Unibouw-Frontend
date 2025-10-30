import { Component, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { rfqService,Rfq} from '../../../services/rfq.service';
import { ActivatedRoute } from '@angular/router';
import { projectdetails, projectService } from '../../../services/project.service';

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
displayedColumns: string[] = [
   
    'customer',
    'rfqSentDate',
    'dueDate',
    'rfqSent',
    'quoteRecieved',
    'actions'
  ];
  dataSource = new MatTableDataSource<any>([]);
 isLoading = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  workItems: WorkItem[] = [
    {
      name: 'Construction',
      requestsSent: 25,
      notResponded: 5,
      interested: 5,
      notInterested: 5,
      viewed: 10,
      open: true,
      searchText: '',
      pageSize: 10,
      currentPage: 1,
      totalPages: 1,
      currentStart: 1,
      currentEnd: 1,
      rfqs: [
        { name: 'Bacany', rating: 4.5, date: '02/04/2025', rfqId: '134354', responded: true, interested: true, viewed: true, quote: '$1.200.000', actions: ['pdf','chat'] },
        { name: 'Contrutiec & Co', rating: 5, date: '02/04/2025', rfqId: '2345645', responded: true, interested: true, viewed: true, quote: '$1.400.000', actions: ['pdf'] },
        { name: 'Sam Constructions', rating: 3.5, date: '02/04/2025', rfqId: '235344', responded: true, interested: true, viewed: true, quote: '—', actions: ['lock'] },
        { name: 'Sowedane', rating: 3.5, date: '02/04/2025', rfqId: '234564', responded: true, interested: false, viewed: true, quote: '$1.500.000,50', actions: ['pdf','chat'] },
        { name: 'Talent Bouw', rating: 3.5, date: '02/04/2025', rfqId: '342524', responded: false, interested: false, viewed: false, quote: '—', actions: ['pdf','chat','lock'] }
      ]
    }
  ];

  constructor(private rfqService:rfqService,  private route: ActivatedRoute,private projectService: projectService){

  }
  ngOnInit(): void {
  // ✅ Capture the project ID from the route
  this.projectId = this.route.snapshot.paramMap.get('id') || '';
  console.log('📦 Captured Project ID:', this.projectId);

  if (this.projectId) {
    this.loadRfqData();
          this.loadProjectDetails(this.projectId);

  } else {
    console.error('❌ Project ID not found in route');
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
loadRfqData(): void {
  this.isLoading = true;

  this.rfqService.getRfqByProjectId(this.projectId).subscribe({
    next: (res) => {
      // Normalize the response (handles both single object or array)
      const rfqs = Array.isArray(res) ? res : [res];

      // Map backend fields → frontend display keys
      this.dataSource.data = rfqs.map((item: any) => ({
        customer: item.customerName || '—',
        rfqSentDate: this.formatDate(item.sentDate),
        dueDate: this.formatDate(item.dueDate),
        rfqSent: item.rfqSent || 0,
        quoteReceived: item.quoteReceived || 0
      }));

      this.isLoading = false;
    },
    error: (err) => {
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
}
