import { Component, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { projectService,projectdetails } from '../../../services/project.service';


@Component({
  selector: 'app-project-details',
  standalone: false,
  templateUrl: './project-details.html',
  styleUrl: './project-details.css'
})
export class ProjectDetails {
constructor(private router: Router,private projectService: projectService) {}


  projectdetails: projectdetails[] = [];
  filteredItems: projectdetails[] = [];
  pagedItems: projectdetails[] = [];

  pageSize = 5;
    pageSizeOptions = [5, 10, 25, 50, 100];

  currentPage = 1;
  totalPages = 1;
  active?: boolean;
 
 displayedColumns: string[] = [
    'number',
    'name',
    'customerName',
    'projectManagerName',
    'startDate',
    'completionDate',
    'status',
    'action'
  ];

  dataSource = new MatTableDataSource<projectdetails>([]);
  searchText = '';

  // Loader flags
  isSkeletonLoading = true;
  isLoading = false;
    @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;


    ngOnInit() {
   this.loadProjects();

    

  }
goToRFQ() {
  this.router.navigate(['/rfq']);
}
 loadProjects(): void {
    this.projectService.getProjects().subscribe({
      next: (data) => {
        this.dataSource.data = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('❌ Failed to fetch projects:', err);
        this.isLoading = false;
      },
    });
  }

   applyFilter() {
    const keyword = this.searchText.toLowerCase();
    this.filteredItems = this.projectdetails.filter(item =>
      item.number.toLowerCase().includes(keyword) ||
      item.name.toLowerCase().includes(keyword) ||
      item.customerName.toLowerCase().includes(keyword)||
      item.projectManagerName.toLowerCase().includes(keyword)||
      item.status.toLowerCase().includes(keyword)


    );

   this.currentPage = 1;
  this.totalPages = Math.ceil(this.filteredItems.length / this.pageSize) || 1;
  this.updatePagedItems();
  }

 updatePagedItems() {
  const start = (this.currentPage - 1) * this.pageSize;
  const end = start + this.pageSize;
  this.pagedItems = this.filteredItems.slice(start, end);
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

  editItem(item: projectdetails) {
    item.editItem = !item.editItem;  // toggle edit mode
  }

goToPage(page: number) {
  if (page >= 1 && page <= this.totalPages) {
    this.currentPage = page;
    this.updatePagedItems();
  }
}

pageSizes: number[] = [5, 10, 25, 50]; // options for dropdown

 onPageSizeChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.paginator.pageSize = this.pageSize;
    this.dataSource.paginator = this.paginator;
  }

get paginationInfo(): string {
  if (!this.filteredItems || this.filteredItems.length === 0) {
    return 'Showing 0 to 0 of 0 entries';
  }

  const start = (this.currentPage - 1) * this.pageSize + 1;
  let end = start + this.pagedItems.length - 1;

  return `Showing ${start} to ${end} of ${this.filteredItems.length} entries`;
}


}
