package PortlarVeAkislar {
  private import ScalarValues::*;

  item def Yakit;
  item def Egzoz;

  port def YakitPortu {
    out item yakitCikis : Yakit;
  }

  port def MotorPortu {
    in item yakitGiris : Yakit;
    out item egzozCikis : Egzoz;
  }

  part def YakitDeposu {
    port yakitCikisPortu : YakitPortu;
  }

  part def Motor {
    port motorPortu : MotorPortu;
    port egzozPortu : ~MotorPortu;
  }

  part def Arac {
    part yakitDeposu : YakitDeposu;
    part motor : Motor;
    flow yakitDeposu.yakitCikisPortu to motor.motorPortu;
  }
}
