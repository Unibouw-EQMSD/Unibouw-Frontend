import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RfqAdd } from './rfq-add';

describe('RfqAdd', () => {
  let component: RfqAdd;
  let fixture: ComponentFixture<RfqAdd>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RfqAdd]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RfqAdd);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
