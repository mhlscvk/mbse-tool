package AracGereksinimleri {
  private import ScalarValues::*;
  private import ISQ::*;

  part def Arac {
    attribute kutle : Real;
    attribute kuruKutle : Real;
    attribute yukKutlesi : Real;
  }

  requirement def KutleGereksinimi {
    doc /* The actual kutle shall be less than the istenen kutle. */
    attribute istenenKutle : Real;
    attribute mevcutKutle : Real;
  }

  requirement def YakitEkonomisiGereksinimi {
    doc /* The yakit ekonomi shall meet or exceed the istenen value. */
    attribute istenenYakitEkonomisi : Real;
  }

  requirement aracSartnamesi {
    doc /* Top-seviye arac specification requirements. */

    requirement aracKutleGereksinimi : KutleGereksinimi {
      doc /* The total kutle of the arac shall be less than or equal to 2000 kg. */
      attribute istenenKutle : Real;
      attribute mevcutKutle : Real;
    }

    requirement sehirYakitEkonomisi : YakitEkonomisiGereksinimi {
      doc /* City yakit ekonomi shall be at least 10 km per litre. */
      attribute istenenYakitEkonomisi : Real;
    }

    requirement otoyolYakitEkonomisi : YakitEkonomisiGereksinimi {
      doc /* Otoyol yakit ekonomi shall be at least 12.75 km per litre. */
      attribute istenenYakitEkonomisi : Real;
    }
  }

  part arac : Arac;
  satisfy aracSartnamesi by arac;
}