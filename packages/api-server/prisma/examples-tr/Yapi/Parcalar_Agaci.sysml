package ParcalarAgaci {
  private import ScalarValues::*;
  private import ISQ::*;

  part def Arac;
  part def Motor;
  part def Sanziman;
  part def SaftMili;
  part def OnAks;
  part def Aks;
  part def Tekerlek;
  part def Diferansiyel;
  part def MarsMotoru;
  part def YakitDeposu;

  part arac : Arac {
    part marsMotoru : MarsMotoru;
    part yakitDeposu : YakitDeposu;
    part motor : Motor;
    part sanziman : Sanziman;
    part saftMili : SaftMili;
    part arkaAksGrubu {
      part diferansiyel : Diferansiyel;
      part arkaAks : Aks;
      part arkaTekerlek1 : Tekerlek;
      part arkaTekerlek2 : Tekerlek;
    }
    part onAksGrubu {
      part onAks : OnAks;
      part onTekerlekler : Tekerlek;
    }
  }
}