import { Component } from '@angular/core';

@Component({
  selector: 'app-add-workitem',
  standalone: false,
  templateUrl: './add-workitem.html',
  styleUrl: './add-workitem.css'
})
export class AddWorkitem {
workitem = {
    code: '',
    workitem: '',
    description: ''
  };

  onSubmit() {
    console.log('Form submitted:', this.workitem);
    // send data to API
  }

  onCancel() {
    this.workitem = { code: '', workitem: '', description: '' };
  }
}
