package Numaralandirmalar {
  private import ScalarValues::*;

  enum def YakitTuru {
    benzin;
    dizel;
    elektrik;
  }

  enum def AtesleAcKapat {
    acik;
    kapali;
  }

  attribute def KosulSeviyesi {
    attribute renk : String;
  }

  enum def RiskSeviyesi {
    dusuk;
    orta;
    yuksek;
  }

  part def YakitDeposu {
    attribute yakitTuru : YakitTuru;
    attribute kapasite : Real;
  }
}