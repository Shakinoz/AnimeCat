import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { SwipePage } from './swipe';

describe('Swipe', () => {
  let component: SwipePage;
  let fixture: ComponentFixture<SwipePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwipePage],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(SwipePage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
