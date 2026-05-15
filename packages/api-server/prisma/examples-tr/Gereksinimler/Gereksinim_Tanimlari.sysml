package GereksinimTanimlari {
  private import ScalarValues::*;
  private import ISQ::*;

  requirement def KutleGereksinimi {
    doc /* The actual kutle shall be less than the istenen kutle. */
    attribute istenenKutle : Real;
    attribute mevcutKutle : Real;
  }

  requirement def YakitEkonomisiGereksinimi {
    doc /* The yakit ekonomi shall meet or exceed the istenen value. */
    attribute istenenYakitEkonomisi : Real;
    attribute mevcutYakitEkonomisi : Real;
  }

  requirement def PerformansGereksinimi {
    doc /* The system shall meet performans targets. */
    attribute hedefDeger : Real;
    attribute olculenDeger : Real;
  }

  constraint def KutleKisitlamasi {
    doc /* Mass must not exceed the maksimum allowed. */
    attribute maksimumKutle : Real;
    attribute mevcutKutle : Real;
  }
}