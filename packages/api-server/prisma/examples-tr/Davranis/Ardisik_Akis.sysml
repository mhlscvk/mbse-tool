package ArdisikAkisOrnegi {
  private import ScalarValues::*;

  item def Goruntu;
  item def Resim;

  action def Odakla {
    in item scene : Goruntu;
    out item goruntu : Goruntu;
  }

  action def Cek {
    in item goruntu : Goruntu;
    out item resim : Resim;
  }

  action def ResimCek {
    in item scene : Goruntu;
    out item resim : Resim;

    action odakla : Odakla;
    action cek : Cek;

    succession flow odakla.goruntu to cek.goruntu;

    first start then odakla;
    first odakla then cek;
    first cek then done;
  }

  part def Kamera {
    part algilayici;
    part islemci;
    message of Goruntu from algilayici to islemci;
  }
}
