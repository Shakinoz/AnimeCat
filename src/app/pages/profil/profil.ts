import { StorageService } from './../../services/storage.service';
import { Component } from '@angular/core';
import { Header } from "../../components/header/header";

@Component({
  selector: 'app-profil',
  imports: [Header],
  templateUrl: './profil.html',
  styleUrl: './profil.scss',
})
export class ProfilPage {
  public user: string;

  constructor(private storageService: StorageService){
    this.user = storageService.getCurrentUser()?.username || '';
  }


}
