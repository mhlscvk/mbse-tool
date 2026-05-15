package AnalizVeDogrulama {
  private import ScalarValues::*;
  private import ISQ::*;

  part def Arac {
    attribute kutle : Real;
  }

  requirement def KutleGereksinimi {
    attribute istenenKutle : Real;
    attribute mevcutKutle : Real;
  }

  requirement aracKutleGer : KutleGereksinimi {
    doc /* Arac kutle shall not exceed 2000 kg. */
    attribute istenenKutle : Real;
    attribute mevcutKutle : Real;
  }

  part arac : Arac;

  analysis case def YakitEkonomisiAnalizi {
    doc /* TahminEt the yakit ekonomi of the arac. */
  }

  analysis case fuelEconomyAnalysis : YakitEkonomisiAnalizi {
    doc /* Hesapla yakit ekonomi for the given scenario. */
    in attribute scenario : String;
  }

  verification case def KutleTesti {
    doc /* Verify the arac kutle meets the requirement. */
  }

  verification case kutleTesti : KutleTesti {
    doc /* Tart the arac and evaluate pass or fail. */
    action araciTart;
    action gectiKaldiyiDegerlendir;
    first start then araciTart;
    first araciTart then gectiKaldiyiDegerlendir;
    first gectiKaldiyiDegerlendir then done;
  }

  satisfy aracKutleGer by arac;
}