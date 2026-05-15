package Baglantilar {
  private import ScalarValues::*;

  port def YakitPortu;
  port def KontrolPortu;
  port def CekisGucPortu;

  part def Motor {
    port yakitGirisPortu : YakitPortu;
    port cekisGucPortu : CekisGucPortu;
    port kontrolPortu : KontrolPortu;
  }

  part def YakitDeposu {
    port yakitCikisPortu : YakitPortu;
  }

  part def Sanziman {
    port debriyajPortu : CekisGucPortu;
    port milPortu : CekisGucPortu;
  }

  part def Denetleyici {
    port kontrolPortu : KontrolPortu;
  }

  interface def YakitArayuzu {
    port yakitCikis : YakitPortu;
    port yakitGiris : YakitPortu;
  }

  part arac {
    part yakitDeposu : YakitDeposu;
    part motor : Motor;
    part sanziman : Sanziman;
    part denetleyici : Denetleyici;
    connect yakitDeposu.yakitCikisPortu to motor.yakitGirisPortu;
    connect motor.cekisGucPortu to sanziman.debriyajPortu;
    connect denetleyici.kontrolPortu to motor.kontrolPortu;
  }
}