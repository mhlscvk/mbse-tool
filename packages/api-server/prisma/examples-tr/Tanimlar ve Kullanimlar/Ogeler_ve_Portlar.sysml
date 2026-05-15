package OgelerVePortlar {
  private import ScalarValues::*;
  private import ISQ::*;

  item def Yakit {
    attribute yakitKutlesi : Real;
  }

  item def YakitKomutu {
    attribute gazSeviyesi : Real;
  }

  item def AtesleKomutu {
    attribute atesleAcKapat : String;
  }

  port def YakitPortu {
    out item yakit : Yakit;
  }

  port def YakitKomutPortu {
    in item yakitKomut : YakitKomutu;
  }

  port def AtesleKomutPortu {
    in item atesleKomut : AtesleKomutu;
  }

  port def CekisGucPortu {
    out item motorTorku : Real;
  }

  interface def YakitArayuzu {
    port yakitCikisPortu : YakitPortu;
    port yakitGirisPortu : YakitPortu;
  }
}