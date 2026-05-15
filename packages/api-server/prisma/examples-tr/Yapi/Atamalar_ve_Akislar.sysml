package AtamalarVeAkislar {
  private import ScalarValues::*;

  part def Algilayici {
    attribute okuma : Real;
  }

  part def Denetleyici {
    attribute komut : Real;
  }

  part def Eyleyici {
    attribute konum : Real;
  }

  item def AlgilayiciVerisi {
    attribute value : Real;
  }

  item def KontrolSinyali {
    attribute seviye : Real;
  }

  part kontrolSistemi {
    part algilayici : Algilayici;
    part denetleyici : Denetleyici;
    part eyleyici : Eyleyici;
    flow from algilayici.okuma to denetleyici.komut;
    flow from denetleyici.komut to eyleyici.konum;
    allocate algilayici.okuma to denetleyici.komut;
  }
}