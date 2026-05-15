package DurumTanimlari {
  private import ScalarValues::*;

  action def Isinma;
  action def Senaryo;
  action def Sogume;

  state def Senaryolama {
    entry action isinma : Isinma;
    do action calistir : Senaryo;
    exit action sogume : Sogume;
  }

  state def AcKapat {
    entry;
    then kapali;

    state kapali;
    state acik;

    transition kapali_acik
      first kapali then acik;
    transition acik_kapali
      first acik then kapali;
  }
}