package Ozellestirme {
  private import ScalarValues::*;

  part def Aks {
    attribute kutle : Real;
  }

  part def OnAks :> Aks {
    attribute direksiyonAcisi : Real;
  }

  part def ArkaAks :> Aks {
    attribute diferansiyelOrani : Real;
  }

  part def Tekerlek {
    attribute cap : Real;
    attribute basinc : Real;
  }

  part def Arac {
    part onAks : OnAks;
    part arkaAks : ArkaAks;
    part onTekerlekler : Tekerlek;
    part arkaTekerlekler : Tekerlek;
  }
}