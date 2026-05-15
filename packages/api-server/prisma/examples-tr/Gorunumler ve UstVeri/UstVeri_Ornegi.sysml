package UstVeriOrnegi {
  private import ScalarValues::*;

  metadata def Approval {
    attribute onaylandi : Boolean;
    attribute onaylayan : String;
  }

  metadata def Guvenlik {
    attribute seviye : String;
  }

  part def FrenSistemi {
    doc /* The arac frenleme system. */
    attribute frenlemeKuvveti : Real;
    attribute tepkiSuresi : Real;
  }

  part def HavaYastigiSistemi {
    doc /* The arac havaYastigi system. */
    attribute aciklimaSuresi : Real;
  }

  part guvenlikSistemi {
    part frenler : FrenSistemi;
    part havaYastiklari : HavaYastigiSistemi;
  }
}