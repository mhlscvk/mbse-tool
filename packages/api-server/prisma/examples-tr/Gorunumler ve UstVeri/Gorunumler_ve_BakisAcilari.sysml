package GorunumlerVeBakisAcilari {

  part def GuvenlikMuhendisi;

  concern def AracGuvenligi {
    doc /* Arac must have necessary guvenlik features. */
  }

  viewpoint def GuvenlikBakisAcisi {
    doc /* Guvenlik muhendislik viewpoint. */
  }

  view def AgacGorunumu {
    doc /* Renders model elements as a tree diagram. */
  }

  view def ParcalarAgaciGorunumu :> AgacGorunumu {
    doc /* A tree view filtreli to show only parcalar. */
  }

  rendering def StandartGorselle {
    doc /* Default rendering for diagram views. */
  }
}