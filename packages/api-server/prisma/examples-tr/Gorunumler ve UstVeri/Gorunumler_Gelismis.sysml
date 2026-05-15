package GorunumlerGelismis {
    part def Arac;
    part def Motor;

    part arac : Arac {
        part motor : Motor;
    }

    /* Viewpoint definition */
    viewpoint def GuvenlikBakisAcisi {
        doc /* Odakla acik guvenlik-related elements and their relationships. */

        stakeholder guvenlikMuhendisi;
    }

    viewpoint def YapiBakisAcisi {
        doc /* Goster system decomposition and part hiyerarsi. */
    }

    /* Rendering definition */
    rendering def AgacGorselle;
    rendering def TabloGorselle;

    /* View definitions with expose and render */
    view def ParcalarAgaciGorunumu {
        expose GorunumlerGelismis::*;

        render asTree : AgacGorselle;
    }

    view def GuvenlikGorunumu {
        expose GorunumlerGelismis::Arac;
        expose GorunumlerGelismis::Motor;

        render asTable : TabloGorselle;
    }

    /* View usages */
    view partsTree : ParcalarAgaciGorunumu;

    /* Viewpoint usage */
    viewpoint guvenlikBA : GuvenlikBakisAcisi;

    /* Rendering usage */
    rendering agacGorselle : AgacGorselle;

    /* Concern usage */
    concern def GuvenirlikIlgisi {
        doc /* Ensure system bilesenler meet guvenirlik targets. */
    }

    concern guvenirlikKontrol : GuvenirlikIlgisi;

    /* Metadata usage */
    metadata def Approval {
        attribute onaylandi : Boolean;
        attribute onaylayan : String;
    }

    metadata onayDurumu : Approval;
}
