package YenidenTanimlamaVeAltKume {

  part def Silindir;

  part def Motor {
    part sil : Silindir[4..6];
    attribute beygirGucu : Real;
  }

  part def KucukMotor :> Motor {
    part redefines sil[4];
  }

  part def BuyukMotor :> Motor {
    part redefines sil[6];
  }

  part def Arac {
    part motor : Motor;
  }

  part def KucukArac :> Arac {
    part kucukMotor : KucukMotor redefines motor;
  }

  part def BuyukArac :> Arac {
    part buyukMotor : BuyukMotor :>> motor;
  }
}
