import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { SubcontractorService, Subcontractors } from '../../services/subcontractor.service';
import { UserService } from '../../services/User.service.';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

@Component({
  selector: 'app-subcontractor',
  standalone: false,
  templateUrl: './subcontractor.html',
  styleUrl: './subcontractor.css',
})
export class Subcontractor implements OnInit, AfterViewInit {
 displayedColumns: string[] = ['name', 'category', 'contactPerson', 'emailId', 'action'];
  dataSource = new MatTableDataSource<Subcontractors>([]);
  
  searchText = '';
  isAdmin = false;

  // Loader flags
  isSkeletonLoading = true;
  isLoading = false;

  // Pagination
  pageSize = 100;
  pageSizeOptions = [5, 10, 25, 50, 100];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private subcontractorService: SubcontractorService,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.isAdmin = this.userService.isAdmin();

    // Show skeleton first, then load table
  this.isSkeletonLoading = true;

  setTimeout(() => {
    this.isSkeletonLoading = false;
    this.isLoading = true;
    this.loadSubcontractors();
  }, 1000);
}

  

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadSubcontractors() {
    this.isLoading = true;

    this.subcontractorService.getSubcontractors().subscribe({
      next: (subcontractors: Subcontractors[]) => {
        this.isLoading = false;

        const mapped = (subcontractors || []).map(it => ({ ...it, isEditing: false }));
        mapped.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        this.dataSource.data = mapped;

        if (this.paginator) this.dataSource.paginator = this.paginator;
        if (this.sort) this.dataSource.sort = this.sort;
      },
      error: (err) => {
        console.error('Error fetching subcontractors', err);
        this.isLoading = false;
        this.dataSource.data = [];
      },
    });
  }

  applyFilter() {
    this.dataSource.filter = this.searchText.trim().toLowerCase();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  onPageSizeChange(event: PageEvent) {
    this.pageSize = event.pageSize;
    this.paginator.pageSize = this.pageSize;
    this.dataSource.paginator = this.paginator;
  }

  toggleIsActive(item: Subcontractors) {
    if (!this.isAdmin) return;

    const newStatus = !item.isActive;
    item.isActive = newStatus;

    this.subcontractorService.updateIsActive(item.id, newStatus).subscribe({
      next: () => console.log('Status updated'),
      error: () => {
        item.isActive = !newStatus;
        console.error('Failed to update status');
      },
    });
  }

  getStartIndex(): number {
    if (!this.paginator) return 0;
    return this.paginator.pageIndex * this.paginator.pageSize + 1;
  }

  getEndIndex(): number {
    if (!this.paginator) return 0;
    const end = (this.paginator.pageIndex + 1) * this.paginator.pageSize;
    return end > this.dataSource.data.length ? this.dataSource.data.length : end;
  }
}