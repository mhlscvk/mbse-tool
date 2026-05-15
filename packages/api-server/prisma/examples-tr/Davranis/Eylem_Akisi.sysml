package EylemAkisi {
  private import ScalarValues::*;

  item def YakitKomutu;
  item def Tork;

  action def GucSagla {
    in item yakitKomut : YakitKomutu;
    out attribute tekerlekTorku : Real;
  }

  action def TorkUret {
    in item yakitKomut : YakitKomutu;
    out item motorTorku : Tork;
  }

  action def TorkYukselt {
    in item motorTorku : Tork;
    out item sanzimanTorku : Tork;
  }

  action def TorkAktar {
    in item sanzimanTorku : Tork;
    out item saftTorku : Tork;
  }

  action def TorkDagit {
    in item saftTorku : Tork;
    out attribute tekerlekTorku : Real;
  }

  action gucSagla : GucSagla {
    action torkUret : TorkUret;
    action torkYukselt : TorkYukselt;
    action torkAktar : TorkAktar;
    action torkDagit : TorkDagit;
    flow torkUret.motorTorku to torkYukselt.motorTorku;
    flow torkYukselt.sanzimanTorku to torkAktar.sanzimanTorku;
    flow torkAktar.saftTorku to torkDagit.saftTorku;
  }
}