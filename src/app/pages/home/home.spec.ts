import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { HomePage } from './home';

describe('Home', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should scroll the provided carousel container', () => {
    const carousel = document.createElement('div');
    Object.defineProperty(carousel, 'clientWidth', { value: 400, configurable: true });
    const scrollBySpy = spyOn(carousel, 'scrollBy');

    component.trendingCarousel = { nativeElement: carousel } as any;
    component.scrollCarousel('trending', 'right');

    expect(scrollBySpy).toHaveBeenCalledWith({ left: 320, behavior: 'smooth' });
  });
});
