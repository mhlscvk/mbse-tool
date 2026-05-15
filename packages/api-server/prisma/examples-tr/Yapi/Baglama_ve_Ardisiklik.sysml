package BaglamaVeArdisiklik {

  part def Algilayici {
    attribute okuma : Real;
  }

  part def Denetleyici {
    attribute komut : Real;
  }

  part def System {
    part algilayici : Algilayici;
    part denetleyici : Denetleyici;
    bind algilayici.okuma = denetleyici.komut;
  }

  action def Adim1;
  action def Adim2;
  action def Adim3;

  action islem {
    action adim1 : Adim1;
    action adim2 : Adim2;
    action adim3 : Adim3;
    first start then adim1;
    first adim1 then adim2;
    first adim2 then adim3;
    first adim3 then done;
  }
}
