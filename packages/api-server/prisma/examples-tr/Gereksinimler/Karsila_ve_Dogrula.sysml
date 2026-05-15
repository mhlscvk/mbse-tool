package KarsilaVeDogrula {
  private import ScalarValues::*;

  part def Arac {
    attribute kutle : Real;
    attribute enHiz : Real;
  }

  requirement def KutleGereksinimi {
    doc /* The arac kutle shall not exceed the specified sinir. */
    attribute kutleSiniri : Real;
    attribute mevcutKutle : Real;
  }

  requirement def PerformansGereksinimi {
    doc /* The arac shall meet minimum performans targets. */
    attribute minimumEnHiz : Real;
  }

  requirement aracSart {
    doc /* Arac specification requirements. */

    requirement kutleGer : KutleGereksinimi {
      doc /* Total kutle shall not exceed 2000 kg. */
    }

    requirement performansGer : PerformansGereksinimi {
      doc /* Top hiz shall exceed 200 km/h. */
    }
  }

  part arac : Arac;

  satisfy aracSart by arac;

  verification case def KutleTesti {
    doc /* Verify the arac kutle requirement. */
  }

  verification case kutleTesti : KutleTesti {
    action araciTart;
    action sonucuDegerlendir;
    first start then araciTart;
    first araciTart then sonucuDegerlendir;
    first sonucuDegerlendir then done;
  }

  verify aracSart.kutleGer by kutleTesti;
}
