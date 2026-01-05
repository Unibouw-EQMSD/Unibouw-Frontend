import { Component, HostListener, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { WorkitemService, Workitem, WorkitemCategory } from '../../services/workitem.service';
import { SubcontractorService } from '../../services/subcontractor.service';
import { UserService } from '../../services/User.service.';
import { Router } from '@angular/router';
import { countryList } from '../../shared/countries';
import { Subscription } from 'rxjs';
import { Location } from '@angular/common';

@Component({
  selector: 'app-add-subcontractor',
  standalone: false,
  templateUrl: './add-subcontractor.html',
  styleUrls: ['./add-subcontractor.css'],
})
export class AddSubcontractor implements OnInit {
  subcontractorForm: FormGroup;
  countryList = countryList;
  countries = countryList.map((c) => c.name);
  isDropdownOpen = false;
  selectedCountry = countryList.find((c) => c.code === '+33') || countryList[0]; // default
  workitems: Workitem[] = [];
  selectedWorkitems: Workitem[] = [];
  selectionsByCategory = new Map<string, Workitem[]>(); // preserve selections per category
  selectedCount = 0;

  persons: any[] = [];
  categories: WorkitemCategory[] = [
    { categoryID: '213cf69b-627e-4962-83ec-53463c8664d2', categoryName: 'Unibouw' },
    { categoryID: '60a1a614-05fd-402d-81b3-3ba05fdd2d8a', categoryName: 'Standard' },
  ];
  selectedCategoryId: string = '';
  attachments: File[] = [];
  uploadedFiles: { name: string; type: string; path: string }[] = [];
  officeSub?: Subscription;

  popupMessage: string = '';
  popupError: boolean = false;
  showPopup: boolean = false;

  private buildTeamsMessage(payload: any, allSelectedWorkitems: Workitem[]): string {
    const CATEGORY_MAP: Record<string, string> = {
      '213cf69b-627e-4962-83ec-53463c8664d2': 'Unibouw',
      '60a1a614-05fd-402d-81b3-3ba05fdd2d8a': 'Standard',
    };

    const grouped = allSelectedWorkitems.reduce((acc: any, item: any) => {
      const category = CATEGORY_MAP[item.categoryID] ?? 'Others';

      if (!acc[category]) acc[category] = [];
      acc[category].push(item.name.replace(/`/g, '')); // safety

      return acc;
    }, {});

    const workItemsText = Object.entries(grouped)
      .map(([category, items]: any) => {
        const list = items.map((name: string, i: number) => `  ${i + 1}. ${name}`).join('\n');

        return `${category}\n${list}`;
      })
      .join('\n\n');

    return `📩 **New Subcontractor Created**
\`\`\`
Subcontractor Name : ${payload.name}
Email              : ${payload.emailID}
Location           : ${payload.location}
Country            : ${payload.country}
Contact Name       : ${payload.contactName}
Contact Email      : ${payload.contactEmailID}
Contact Phone      : ${payload.phoneNumber1}
Office Address     : ${payload.officeAddress}

Work Items:
${workItemsText}
\`\`\``; // 👈 DO NOT add anything after this
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private workItemService: WorkitemService,
    private subcontractorService: SubcontractorService,
    private userService: UserService,
    private location: Location
  ) {
    this.subcontractorForm = this.fb.group({
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(150),
          Validators.pattern(/^(?=.*\S)[A-Za-z .\-&]+$/),
        ],
      ],
      location: [
        '',
        [Validators.required, Validators.maxLength(100), Validators.pattern(/^[A-Za-z0-9,\-\s]+$/)],
      ],
      country: ['', Validators.required],
      registeredDate: [''],
      email: [
        '',
        [
          Validators.required,
          Validators.maxLength(100),
          Validators.pattern(
            /^[a-zA-Z0-9]+([._%+-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/
          ),
        ],
      ],
      contactEmail: [
        '',
        [
          Validators.required,
          Validators.maxLength(100),
          Validators.pattern(
            /^[a-zA-Z0-9]+([._%+-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/
          ),
        ],
      ],
      status: ['Active', Validators.required],
      officeAddress: [
        '',
        [
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(300),
          Validators.pattern(/^[A-Za-z0-9,.\-\/\s\r\n]+$/),
        ],
      ],
      billingAddress: [
        '',
        [
          Validators.minLength(10),
          Validators.maxLength(300),
          Validators.pattern(/^[A-Za-z0-9,.\-\/\s\r\n]+$/),
        ],
      ],
      sameAsOffice: [false],
      countryCode: [this.selectedCountry.code],
      contactNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{8,15}$/)]],
      contactPerson: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(150),
          Validators.pattern(/^(?=.*\S)[A-Za-z.\-\s]+$/),
        ],
      ],
      attachments: [null],
    });
  }

  ngOnInit() {
    this.loadPersons();

    if (this.categories.length > 0) {
      this.selectedCategoryId = this.categories[0].categoryID;
      this.loadWorkitems();
    }

    const officeCtrl = this.subcontractorForm.get('officeAddress');
    const billingCtrl = this.subcontractorForm.get('billingAddress');
    const sameAsCtrl = this.subcontractorForm.get('sameAsOffice');

    sameAsCtrl?.valueChanges.subscribe((checked) => {
      if (checked) {
        billingCtrl?.setValue(officeCtrl?.value);
        billingCtrl?.disable();

        if (this.officeSub) this.officeSub.unsubscribe();
        this.officeSub = officeCtrl?.valueChanges.subscribe((val) => {
          billingCtrl?.setValue(val, { emitEvent: false });
        });
      } else {
        if (this.officeSub) this.officeSub.unsubscribe();
        billingCtrl?.enable();
        billingCtrl?.setValue('');
      }
    });
  }

  goBack(): void {
    this.location.back();
  }

  /** Dropdown logic */
  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  selectCountry(country: any) {
    this.selectedCountry = country;
    this.subcontractorForm.patchValue({ countryCode: country.code });
    this.isDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-select-wrapper')) this.isDropdownOpen = false;
  }

  /** Load workitems per category */
  loadWorkitems() {
    this.workItemService.getWorkitems(this.selectedCategoryId).subscribe((items) => {
      this.workitems = (items || [])
        .filter((w) => w.isActive !== false)
        .map((w) => ({ ...w, categoryID: this.selectedCategoryId }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // Restore selections for this category
      this.selectedWorkitems = this.selectionsByCategory.get(this.selectedCategoryId) || [];
      this.selectedCount = this.selectedWorkitems.length;
    });
  }

  selectCategory(id: string) {
    this.selectionsByCategory.set(this.selectedCategoryId, this.selectedWorkitems);
    this.selectedCategoryId = id;
    this.loadWorkitems();
  }

  toggleWorkitem(event: any, item: Workitem) {
    const itemWithCategory = { ...item, categoryID: this.selectedCategoryId };
    if (event.target.checked) {
      if (!this.selectedWorkitems.some((w) => w.workItemID === item.workItemID)) {
        this.selectedWorkitems.push(itemWithCategory);
      }
    } else {
      this.selectedWorkitems = this.selectedWorkitems.filter(
        (w) => w.workItemID !== item.workItemID
      );
    }
    this.selectionsByCategory.set(this.selectedCategoryId, this.selectedWorkitems);
  }

  isSelected(w: Workitem): boolean {
    return this.selectedWorkitems.some((sw) => sw.workItemID === w.workItemID);
  }

  getSelectedCount(categoryId: string): number {
    return (this.selectionsByCategory.get(categoryId) || []).length;
  }

  workitemSearch: string = '';
  filteredWorkitems() {
    if (!this.workitemSearch) return this.workitems;
    const term = this.workitemSearch.toLowerCase();
    return this.workitems.filter((w) => w.name.toLowerCase().includes(term));
  }

  /** File uploads */
  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) this.addAttachment(file);
    event.target.value = '';
  }

  addMoreFiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (event: any) => {
      const file: File = event.target.files[0];
      if (file) this.addAttachment(file);
    };
    input.click();
  }

  private addAttachment(file: File) {
    this.attachments.push(file);
    this.uploadedFiles.push({ name: file.name, type: file.type, path: `uploads/${file.name}` });
    this.subcontractorForm.patchValue({ attachments: this.attachments });
  }

  removeFile(index: number) {
    this.attachments.splice(index, 1);
    this.uploadedFiles.splice(index, 1);
    this.subcontractorForm.patchValue({ attachments: this.attachments });
  }

  loadPersons(): void {
    this.subcontractorService.getPersons().subscribe({
      next: (res: any[]) => (this.persons = res),
      error: (err: any) => console.error('Error fetching persons:', err),
    });
  }

  submitAttempted = false;

  private logFormValidationErrors(form: FormGroup) {
    Object.keys(form.controls).forEach((key) => {
      const control = form.get(key);

      if (control && control.invalid) {
        console.warn(`❌ Validation failed for: ${key}`);
        console.table(control.errors);
      }
    });
  }

  /** Form submission */
  onSubmit() {
    // this.submitAttempted = true;

    // // Mark the form fields as touched so validation errors appear
    // this.subcontractorForm.markAllAsTouched();

    // const allSelectedWorkitems = Array.from(this.selectionsByCategory.values()).flat();
    // if (allSelectedWorkitems.length === 0 || this.subcontractorForm.invalid) {
    //   return;
    // }

    this.submitAttempted = true;

    this.subcontractorForm.markAllAsTouched();

    const allSelectedWorkitems = Array.from(this.selectionsByCategory.values()).flat();

    if (this.subcontractorForm.invalid) {
      console.warn('🚫 Form is INVALID');
      this.logFormValidationErrors(this.subcontractorForm);
    }

    if (allSelectedWorkitems.length === 0) {
      console.warn('🚫 No work items selected');
    }

    if (allSelectedWorkitems.length === 0 || this.subcontractorForm.invalid) {
      return;
    }

    const formValue = this.subcontractorForm.value;

    const payload = {
      erp_ID: formValue.erpId?.trim() || '',
      name: formValue.name?.trim(),
      rating: formValue.rating || 0,
      emailID: formValue.email, // main subcontractor email
      phoneNumber1: this.selectedCountry.code + ' ' + formValue.contactNumber,
      phoneNumber2: '', // optional
      location: formValue.location,
      country: formValue.country,
      officeAddress: formValue.officeAddress,
      billingAddress: formValue.sameAsOffice
        ? formValue.officeAddress
        : formValue.billingAddress || '',
      personID: null,
      workItemIDs: Array.from(
        new Set(
          Array.from(this.selectionsByCategory.values())
            .flat()
            .map((w) => w.workItemID)
        )
      ),
      contactName: formValue.contactPerson,
      contactEmailID: formValue.contactEmail,
      contactPhone: this.selectedCountry.code + formValue.contactNumber,
    };

    this.subcontractorService.createSubcontractor(payload).subscribe({
      next: (res) => {
        this.handleSuccess(res, formValue.attachments || []);

        // 🔔 Send MS Teams notification
        const teamsMessage = this.buildTeamsMessage(payload, allSelectedWorkitems);

        this.userService.sendMsTeamsNotification(teamsMessage).subscribe({
          next: () => console.log('Teams notification sent'),
          error: (err: any) => console.error('Teams notification failed', err),
        });
      },
      error: (err) => {
        console.error('API ERROR:', err);

        if (err.status === 409 && err.error?.field) {
          const field = err.error.field;
          const message = err.error.message || 'Already exists.';

          if (field === 'email') {
            this.subcontractorForm.get('email')?.setErrors({
              emailExists: message,
            });
          }

          if (field === 'name') {
            this.subcontractorForm.get('name')?.setErrors({
              nameExists: message,
            });
          }
        }
      },
    });
  }

  private handleSuccess(res: any, files: File[]) {
    const subcontractorID = res?.subcontractorID || res?.id;

    if (subcontractorID && files.length > 0) {
      this.subcontractorService.createAttachments(subcontractorID, files).subscribe({
        next: () => {
          this.showPopupMessage('Subcontractor and files uploaded successfully!');
          this.handleFormResetAndRedirect();
        },
        error: (uploadErr) => {
          console.error('File upload failed:', uploadErr);
          this.showPopupMessage('File upload failed.', true);
        },
      });
    } else {
      this.showPopupMessage('Subcontractor created successfully!');
      this.handleFormResetAndRedirect();
    }
  }

  private handleError(err: any) {
    console.error('Backend error:', err);
    const errorMessage =
      err?.error?.message ||
      err?.error?.error ||
      JSON.stringify(err?.error?.errors) || // show validation errors
      err?.message ||
      'Failed to create Subcontractor. Please try again.';
    this.showPopupMessage(errorMessage, true);
  }

  private handleFormResetAndRedirect(): void {
    this.onReset();
    setTimeout(() => this.router.navigate(['/subcontractor']), 1000);
  }

  onReset() {
    this.subcontractorForm.reset();
    this.subcontractorForm.patchValue({ status: 'Active', country: '' });
    this.submitAttempted = false;
    this.selectedWorkitems = [];
    this.selectedCountry = countryList.find((c) => c.code === '+33') || countryList[0];
    this.uploadedFiles = [];

    const fileInput = document.querySelector<HTMLInputElement>('#fileInput');
    if (fileInput) fileInput.value = '';

    this.selectionsByCategory.clear();
  }

  onCancel() {
    this.router.navigate(['/subcontractor']);
  }

  showPopupMessage(message: string, isError: boolean = false) {
    this.popupMessage = message;
    this.popupError = isError;
    this.showPopup = true;
    setTimeout(() => (this.showPopup = false), 3000);
  }
}
