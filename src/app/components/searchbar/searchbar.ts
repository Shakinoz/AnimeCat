import { Component } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatSuffix } from '@angular/material/form-field';

@Component({
  standalone: true,
  selector: 'app-searchbar',
  imports: [MatFormField, MatInput, MatSuffix, MatIcon, MatIconButton],
  templateUrl: './searchbar.html',
  styleUrl: './searchbar.scss',
})
export class Searchbar {
  public onSearch() {
    console.log('en travaux');
  }
}
