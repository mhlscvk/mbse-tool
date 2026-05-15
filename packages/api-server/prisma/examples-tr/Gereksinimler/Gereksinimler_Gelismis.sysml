package GereksinimlerGelismis {
    part def Arac;
    part def FrenlemeSistemi;

    attribute def Mass;
    attribute def Speed;

    /* Constraint definition and usage */
    constraint def MaksimumKutleKisitlamasi {
        attribute kutleSiniri : Mass;
        attribute mevcutKutle : Mass;
    }

    constraint kutleKontrolu : MaksimumKutleKisitlamasi;
    constraint hizKontrolu {
        attribute maksimumHiz : Speed;
    }

    /* Requirement with concern */
    concern def GuvenlikIlgisi {
        doc /* Paydaslar are concerned about arac guvenlik. */
        stakeholder duzenleyiciOrgan;
    }

    requirement def FrenlemeGereksinimi {
        doc /* The frenleme system shall durdur the arac within istenen mesafe. */
        subject frenlemeSistemi : FrenlemeSistemi;

        attribute durmaMesafesi : Mass;
        attribute maksimumHiz : Speed;

        /* Assert constraint within requirement */
        assert constraint mesafeSiniri : MaksimumKutleKisitlamasi;
    }

    requirement frenlemeSart : FrenlemeGereksinimi {
        subject frenler : FrenlemeSistemi;
    }

    concern guvenlikIlgisi : GuvenlikIlgisi;

    part arac : Arac {
        part frenler : FrenlemeSistemi;

        /* Satisfy requirement */
        satisfy requirement frenlemeSart by frenler;
    }
}
