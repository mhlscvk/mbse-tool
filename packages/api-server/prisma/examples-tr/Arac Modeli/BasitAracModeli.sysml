package BasitAracModeli {
  private import ScalarValues::*;
  private import ISQ::*;

  package Tanimlar {
    part def Arac {
      attribute kutle : Real;
      attribute hiz : Real;
      attribute konum : Real;
    }

    part def Motor {
      attribute beygirGucu : Real;
      attribute silindirHacmi : Real;
    }

    part def Sanziman;
    part def SaftMili;
    part def YakitDeposu;
    part def Tekerlek;
    part def Aks;
    part def OnAks :> Aks;
    part def MarsMotoru;
    part def Diferansiyel;

    enum def YakitTuru {
      benzin;
      dizel;
    }

    item def Yakit {
      attribute yakitKutlesi : Real;
    }

    item def YakitKomutu {
      attribute gazSeviyesi : Real;
    }

    port def YakitPortu;
    port def KontrolPortu;
    port def CekisGucPortu;
    port def AtesleKomutPortu;

    action def GucSagla {
      in item yakitKomut : YakitKomutu;
      out attribute tekerlekTorku : Real;
    }

    action def KendiniTestEt;
    action def ElFreniniUygula;
    action def SicakligiAlgila;

    requirement def KutleGereksinimi {
      doc /* The actual kutle shall be less than the istenen kutle. */
      attribute istenenKutle : Real;
      attribute mevcutKutle : Real;
    }
  }

  package AracYapilandirmasi {
    part arac : Tanimlar::Arac {
      part marsMotoru : Tanimlar::MarsMotoru;
      part yakitDeposu : Tanimlar::YakitDeposu;
      part motor : Tanimlar::Motor;
      part sanziman : Tanimlar::Sanziman;
      part saftMili : Tanimlar::SaftMili;
      part arkaAksGrubu {
        part diferansiyel : Tanimlar::Diferansiyel;
        part arkaAks : Tanimlar::Aks;
        part arkaTekerlek1 : Tanimlar::Tekerlek;
        part arkaTekerlek2 : Tanimlar::Tekerlek;
      }
      part onAksGrubu {
        part onAks : Tanimlar::OnAks;
        part onTekerlekler : Tanimlar::Tekerlek;
      }
    }
  }

  package EylemAgaci {
    action def TorkUret;
    action def TorkYukselt;
    action def TorkAktar;
    action def TorkDagit;

    action gucSagla : Tanimlar::GucSagla {
      action torkUret : TorkUret;
      action torkYukselt : TorkYukselt;
      action torkAktar : TorkAktar;
      action torkDagit : TorkDagit;
      first start then torkUret;
      first torkUret then torkYukselt;
      first torkYukselt then torkAktar;
      first torkAktar then torkDagit;
      first torkDagit then done;
    }
  }

  package Durumlar {
    state def AracCalismaDurumlari {
      entry;
      then kapali;

      state kapali;
      state baslatiliyor;
      state acik {
        entry action kendiniTest : Tanimlar::KendiniTestEt;
        do action guc : Tanimlar::GucSagla;
        exit action fren : Tanimlar::ElFreniniUygula;
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
  }

  package Gereksinimler {
    requirement aracSart {
      doc /* Top-seviye arac specification. */

      requirement aracKutleGer : Tanimlar::KutleGereksinimi {
        doc /* Arac kutle shall not exceed 2000 kg. */
        attribute istenenKutle : Real;
        attribute mevcutKutle : Real;
      }
    }

    satisfy aracSart by AracYapilandirmasi::arac;
  }
}