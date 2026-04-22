import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-confirm-dialog-component',

  //THIS is the key fix
  standalone: true,

  //Import everything the template needs
  imports: [CommonModule, MatDialogModule, MatButtonModule,TranslateModule],

  templateUrl: './confirm-dialog-component.html',
  styleUrls: ['./confirm-dialog-component.css'],
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
        private translate: TranslateService,

  ) {}

  onYes() {
    this.dialogRef.close(true);
  }

  onNo() {
    this.dialogRef.close(false);
  }
}
