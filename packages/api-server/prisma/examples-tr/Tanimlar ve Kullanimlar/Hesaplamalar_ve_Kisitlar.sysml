package HesaplamalarVeKisitlar {
    attribute def Mass;
    attribute def YakitTuketimi;
    attribute def Distance;

    /* Calculation definitions for analysis */
    calc def YakitEkonomisiHesabi {
        in attribute mesafe : Distance;
        in attribute kullanilanYakit : YakitTuketimi;
        return attribute ekonomi : YakitTuketimi;
    }

    calc def ToplamKutleHesabi {
        in attribute kuruKutle : Mass;
        in attribute yukKutlesi : Mass;
        return attribute toplamKutle : Mass;
    }

    /* Calculation usages */
    calc yakitEkonomisi : YakitEkonomisiHesabi;
    calc toplamKutle : ToplamKutleHesabi;

    /* Constraint definition */
    constraint def KutleSiniri {
        attribute maksimumKutle : Mass;
        attribute mevcutKutle : Mass;
    }

    /* Constraint usage */
    constraint aracKutleSiniri : KutleSiniri;

    part def Arac {
        attribute kutle : Mass;
        attribute yuk : Mass;

        /* Assert constraint */
        assert constraint kutleUygun : KutleSiniri;
    }
}
