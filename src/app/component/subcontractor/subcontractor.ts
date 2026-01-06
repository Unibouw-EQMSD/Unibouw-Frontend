import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { SubcontractorService, Subcontractors } from '../../services/subcontractor.service';
import { UserService } from '../../services/User.service.';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { forkJoin } from 'rxjs/internal/observable/forkJoin';

@Component({
  selector: 'app-subcontractor',
  standalone: false,
  templateUrl: './subcontractor.html',
  styleUrl: './subcontractor.css',
})
export class Subcontractor implements OnInit, AfterViewInit {
  projectID: string | null = null;
  projectName: string | null = null;

  displayedColumns: string[] = ['name', 'category', 'contactNumber', 'contactPerson', 'emailId'];
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
  showPopup = false;
  popupMessage = '';
  popupError = false;
  constructor(
    private subcontractorService: SubcontractorService,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.isAdmin = this.userService.isAdmin(); // Check role
    this.updateDisplayedColumns();
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'contactNumber':
          return item.phoneNumber1 || '';
        case 'contactPerson':
          return item.personName || '';
        case 'emailId':
          return item.emailID || '';
        default:
          return (item as any)[property] || '';
      }
    };
    // Show skeleton first, then load table
    this.isSkeletonLoading = true;

    setTimeout(() => {
      this.isSkeletonLoading = false;
      this.isLoading = true;
      this.loadSubcontractors();
    }, 1000);
  }

  updateDisplayedColumns() {
    if (this.isAdmin) {
      if (!this.displayedColumns.includes('action')) {
        this.displayedColumns.push('action');
      }
    } else {
      this.displayedColumns = this.displayedColumns.filter((c) => c !== 'action');
    }
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadSubcontractors() {
    this.isLoading = true;

    forkJoin({
      subcontractors: this.subcontractorService.getSubcontractors(),
      mappings: this.subcontractorService.getSubcontractorWorkItemMappings(),
    }).subscribe({
      next: ({ subcontractors, mappings }) => {
        // Merge: attach work items to subcontractors
        const merged = subcontractors.map((sub) => {
          const related = mappings
            .filter((m) => m.subcontractorName?.trim() === sub.name?.trim())
            .map((m) => m.workItemName)
            .join(', ');
          return { ...sub, category: related || '-' };
        });

        this.dataSource.data = merged;
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('❌ API Error:', err);
        this.isLoading = false;
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

    this.subcontractorService.updateIsActive(item.subcontractorID, newStatus).subscribe({
      next: () => this.showPopupMessage('Status updated successfully!'),
      error: () => {
        item.isActive = !newStatus;
        this.showPopupMessage('Failed to update status. Please try again.', true);
      },
    });
  }
  showPopupMessage(message: string, isError: boolean = false) {
    this.popupMessage = message;
    this.popupError = isError;
    this.showPopup = true;
    setTimeout(() => (this.showPopup = false), 3000);
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
