import { Component, HostListener, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { WorkitemService, Workitem, WorkitemCategory } from '../../services/workitem.service';
import { SubcontractorService } from '../../services/subcontractor.service';
import { UserService } from '../../services/User.service.';
import { Router, ActivatedRoute } from '@angular/router';
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
  categories: WorkitemCategory[] = [];

  selectedCategoryId: string = '';
  attachments: File[] = [];
  uploadedFiles: { name: string; type: string; path: string }[] = [];
  officeSub?: Subscription;

  popupMessage: string = '';
  popupError: boolean = false;
  showPopup: boolean = false;

  projectId: string | null = null;
  projectName: string | null = null;
  projectCode: string | null = null;
  rfqIdForEdit: string | null = '';

  private buildTeamsMessage(payload: any, allSelectedWorkitems: Workitem[]): string {
    const CATEGORY_MAP: Record<string, string> = {
      '213cf69b-627e-4962-83ec-53463c8664d2': 'Unibouw',
      '60a1a614-05fd-402d-81b3-3ba05fdd2d8a': 'Standard',
    };

    const grouped = allSelectedWorkitems.reduce((acc: any, item: any) => {
      const category = CATEGORY_MAP[item.categoryID] ?? 'Others';
      if (!acc[category]) acc[category] = [];

      acc[category].push({
        name: item.name.replace(/`/g, ''),
        code: item.code ?? item.number ?? '',
      });

      return acc;
    }, {});

    const workItemsText = Object.entries(grouped)
      .map(([category, items]: any) => {
        const list = items
          .map(
            (item: any, i: number) =>
              `  ${i + 1}. ${item.name}${item.code ? ` (Code: ${item.code})` : ''}`,
          )
          .join('\n');

        return `${category}\n${list}`;
      })
      .join('\n\n');

    //TEAMS-SAFE Office Address formatting
    const OFFICE_LABEL = 'Office Address     : ';
    const OFFICE_PADDING = ' '.repeat(OFFICE_LABEL.length);

    const officeAddressText = payload.officeAddress
      ? payload.officeAddress.trim().replace(/\r?\n\s*/g, `\n${OFFICE_PADDING}`)
      : '';

    const billingAddressText = payload.billingAddress
      ? payload.billingAddress.trim().replace(/\r?\n\s*/g, `\n${OFFICE_PADDING}`)
      : '';

    const today = new Date();
    const currentDate =
      String(today.getDate()).padStart(2, '0') +
      '-' +
      String(today.getMonth() + 1).padStart(2, '0') +
      '-' +
      today.getFullYear();

    return `📩 **${
      this.projectName && this.projectName !== 'null'
        ? 'New Subcontractor Added to an RFQ'
        : 'New Subcontractor Created'
    }**
\`\`\`
Subcontractor Name : ${payload.name}
Email              : ${payload.email}
Location           : ${payload.location}
Country            : ${payload.country}
Contact Name       : ${payload.contactName}
Contact Email      : ${payload.contactEmail}
Contact Phone      : ${payload.phoneNumber1}
Office Address     : ${officeAddressText}
Billing Address    : ${billingAddressText}
${
  this.projectName && this.projectName !== 'null'
    ? `Project Name       : ${this.projectName} (Code: ${this.projectCode})
Created Date        : ${currentDate}`
    : ''
}

Work Items:
${workItemsText}
\`\`\``;
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private workItemService: WorkitemService,
    private subcontractorService: SubcontractorService,
    private userService: UserService,
    private location: Location,
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
            /^[a-zA-Z0-9]+([._%+-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/,
          ),
        ],
      ],
      contactEmail: [
        '',
        [
          Validators.required,
          Validators.maxLength(100),
          Validators.pattern(
            /^[a-zA-Z0-9]+([._%+-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/,
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
    this.route.paramMap.subscribe((params) => {
      this.projectName = params.get('projectName');
      this.projectId = params.get('projectID');
      this.projectCode = params.get('projectCode');
          
    });

    this.route.queryParamMap.subscribe((q) => {
    this.rfqIdForEdit = q.get('rfqId'); // ✅ now you will get it
    console.log(this.rfqIdForEdit, 'RFQ Edit ID');
  });
    this.loadPersons();

    this.loadCategories();

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
  async loadCategories() {
    try {
      const data = await this.workItemService.getCategoriesAsync();

      this.categories = data
        .map((cat) => ({
          categoryID: cat.categoryID,
          categoryName: this.getCategoryTranslationKey(cat.categoryName),
          originalName: cat.categoryName, // Keep original for sorting
        }))
        // .sort((a, b) => {
        //   // Define custom order
        //   const order = ['Unibouw', 'Standard'];
        //   return order.indexOf(a.originalName) - order.indexOf(b.originalName);
        // });
        .sort((a, b) => Number(a.categoryID) - Number(b.categoryID)); // Convert to number

      // Auto-select first category and load its workitems
      if (this.categories.length > 0) {
        this.selectedCategoryId = this.categories[0].categoryID;
        this.loadWorkitems();
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  }

  /**
   * Map backend category names to translation keys
   */
  getCategoryTranslationKey(categoryName: string): string {
    const keyMap: { [key: string]: string } = {
      Unibouw: 'WORKITEM.TAB_UNIBOUW',
      Standard: 'WORKITEM.TAB_STANDARD',
    };
    return keyMap[categoryName] || categoryName;
  }

  /**
   * Load workitems for the selected category
   */
  loadWorkitems() {
    this.workItemService.getWorkitems(this.selectedCategoryId).subscribe({
      next: (items) => {
        this.workitems = (items || [])
          .filter((w) => w.isActive !== false)
          .map((w) => ({ ...w, categoryID: this.selectedCategoryId }))
          .sort((a, b) => a.name.localeCompare(b.name));

        // Restore selections for this category
        this.selectedWorkitems = this.selectionsByCategory.get(this.selectedCategoryId) || [];
        this.selectedCount = this.selectedWorkitems.length;
      },
      error: (err) => {
        console.error('Failed to load workitems', err);
      },
    });
  }

  /**
   * Switch category and preserve selections
   */
  selectCategory(id: string) {
    // Save current category selections
    this.selectionsByCategory.set(this.selectedCategoryId, this.selectedWorkitems);

    // Switch to new category
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
        (w) => w.workItemID !== item.workItemID,
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
    const allSelectedWorkitems1 = Array.from(this.selectionsByCategory.values()).flat();
    console.log('Selected Workitems:', allSelectedWorkitems1);
    if (this.submitAttempted) return;
    this.submitAttempted = true;

    this.subcontractorForm.markAllAsTouched();

    const allSelectedWorkitems = Array.from(this.selectionsByCategory.values()).flat();

    if (this.subcontractorForm.invalid) {
      this.submitAttempted = false;
      this.logFormValidationErrors(this.subcontractorForm);
      return;
    }

    if (allSelectedWorkitems.length === 0) {
      this.submitAttempted = false;
      return;
    }

    const formValue = this.subcontractorForm.value;

    const payload = {
      erp_ID: formValue.erpId?.trim() || '',
      name: formValue.name?.trim(),
      rating: formValue.rating || 0,
      email: formValue.email, // main subcontractor email
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
            .map((w) => w.workItemID),
        ),
      ),
      contactName: formValue.contactPerson,
      contactEmail: formValue.contactEmail,
      contactPhone: this.selectedCountry.code + formValue.contactNumber,
    };

    this.subcontractorService.createSubcontractor(payload).subscribe({
      next: (res) => {
        this.submitAttempted = false;
        // 🔔 Send MS Teams notification
        const teamsMessage = this.buildTeamsMessage(payload, allSelectedWorkitems);

        this.userService.sendMsTeamsNotification(teamsMessage).subscribe({
          next: () => console.log('Teams notification sent'),
          error: (err: any) => console.error('Teams notification failed', err),
        });

        this.handleSuccess(res, formValue.attachments || []);
      },
      error: (err) => {
        this.submitAttempted = false;
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
      if (this.projectId && this.projectId !== 'null') {
        this.showPopupMessage('Subcontractors added to the RFQ successfully.');
      } else {
        this.showPopupMessage('Subcontractor created successfully.');
      }

      this.handleFormResetAndRedirect();
    }
  }

private handleFormResetAndRedirect(): void {
  this.onReset();

  if (this.projectId && this.projectId !== 'null') {
    setTimeout(() => {
      if (this.rfqIdForEdit) {
        this.router.navigate(['/add-rfq', this.projectId, { rfqId: this.rfqIdForEdit }]);
      } else {
        this.router.navigate(['/add-rfq', this.projectId]);
      }
    }, 1000);
  } else {
    setTimeout(() => this.router.navigate(['/subcontractor']), 1000);
  }
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
