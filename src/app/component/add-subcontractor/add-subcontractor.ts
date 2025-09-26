import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-add-subcontractor',
  standalone: false,
  templateUrl: './add-subcontractor.html',
  styleUrl: './add-subcontractor.css'
})
export class AddSubcontractor {
subcontractorForm: FormGroup;
  countries = ['Afghanistan', 'India', 'USA', 'Germany', 'Netherlands'];
  workitems = [
    'Groundwork', 'Foundation', 'Construction', 'Finishing',
    'Electricity', 'Sanitary', 'Pavement', 'Inspection',
    'Roofing', 'Carpentry', 'Painting'
  ];

  constructor(private fb: FormBuilder) {
    this.subcontractorForm = this.fb.group({
      name: [''],
      location: [''],
      country: [''],
      registeredDate: [''],
      email: [''],
      status: ['Active'],
      officeAddress: [''],
      billingAddress: [''],
      sameAsOffice: [false],
      attachments: [null]
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    this.subcontractorForm.patchValue({ attachments: file });
  }

  toggleWorkitem(event: any) {
    console.log(event.target.value, event.target.checked);
  }

  onSubmit() {
    console.log(this.subcontractorForm.value);
  }

  onCancel() {
    this.subcontractorForm.reset();
  }
}