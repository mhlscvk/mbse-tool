package Interconnection {
  private import ScalarValues::*;

  item def Signal;
  item def Guc;

  port def VeriPortu {
    in item veriGirisi : Signal;
    out item veriCikis : Signal;
  }

  port def GucPortu {
    in item gucGiris : Guc;
  }

  part def Algilayici {
    port veriPortu : VeriPortu;
    attribute okuma : Real;
  }

  part def Denetleyici {
    port algilayiciPortu : ~VeriPortu;
    port eyleyiciPortu : VeriPortu;
    port gucPortu : GucPortu;
  }

  part def Eyleyici {
    port komutPortu : ~VeriPortu;
    attribute konum : Real;
  }

  part def GucKaynagi {
    port gucCikis : ~GucPortu;
  }

  part kontrolSistemi {
    part algilayici : Algilayici;
    part denetleyici : Denetleyici;
    part eyleyici : Eyleyici;
    part guc : GucKaynagi;

    connect algilayici.veriPortu to denetleyici.algilayiciPortu;
    connect denetleyici.eyleyiciPortu to eyleyici.komutPortu;
    connect guc.gucCikis to denetleyici.gucPortu;
  }
}
