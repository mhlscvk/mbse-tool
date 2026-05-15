package EylemParametreleri {
  private import ScalarValues::*;

  item def YakitKomutu {
    attribute gazSeviyesi : Real;
  }

  item def Tork;

  action def TorkUret {
    in item yakitKomut : YakitKomutu;
    out item motorTorku : Tork;
  }

  action def TorkYukselt {
    in item girdiTorku : Tork;
    out item ciktiTorku : Tork;
  }

  action def GucSagla {
    in item yakitKomut : YakitKomutu;
    out attribute tekerlekTorku : Real;

    action uret : TorkUret;
    action yukselt : TorkYukselt;

    flow uret.motorTorku to yukselt.girdiTorku;

    first start then uret;
    first uret then yukselt;
    first yukselt then done;
  }
}
