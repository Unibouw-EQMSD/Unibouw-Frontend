import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddWorkitem } from './add-workitem';

describe('AddWorkitem', () => {
  let component: AddWorkitem;
  let fixture: ComponentFixture<AddWorkitem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddWorkitem],
    }).compileComponents();

    fixture = TestBed.createComponent(AddWorkitem);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
