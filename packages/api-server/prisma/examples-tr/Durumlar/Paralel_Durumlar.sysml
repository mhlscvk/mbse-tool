package ParalelDurumlar {

  action def KendiniTestEt;
  action def GucSagla;
  action def ElFreniniUygula;

  state def AracCalismaDurumlari {
    entry;
    then kapali;

    state kapali;
    state baslatiliyor;
    state acik {
      entry action kendiniTest : KendiniTestEt;
      do action guc : GucSagla;
      exit action fren : ElFreniniUygula;
    }

    transition kapali_baslatiliyor
      first kapali then baslatiliyor;
    transition baslatiliyor_acik
      first baslatiliyor then acik;
    transition acik_kapali
      first acik then kapali;
  }

  state def AracSaglikDurumlari {
    entry;
    then normal;

    state normal;
    state bozulmus;

    transition normal_bozulmus
      first normal then bozulmus;
    transition bozulmus_normal
      first bozulmus then normal;
  }

  state def AracDurumlari paralel {
    state calismaDurumlari : AracCalismaDurumlari;
    state saglikDurumlari : AracSaglikDurumlari;
  }
}
