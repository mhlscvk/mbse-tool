package BaglantilarAkislarOlaylar {
    /* Occurrence definitions model things that happen over time */
    occurrence def BakimOlayi;
    occurrence def BaslatmaDizisi;

    occurrence bakimKontrol : BakimOlayi;
    occurrence sistemBaslatma : BaslatmaDizisi;

    item def Yakit;
    item def Sogutucu;

    port def YakitCikisPortu {
        out item yakitAkis : Yakit;
    }

    port def YakitGirisPortu {
        in item yakitAkis : Yakit;
    }

    /* Conjugated port definition */
    port def TersYakitPortu conjugates YakitCikisPortu;

    part def YakitDeposu {
        port yakitCikis : YakitCikisPortu;
    }

    part def Motor {
        port yakitGiris : YakitGirisPortu;
        port sogutucuPortu : ~YakitCikisPortu;
    }

    part def SogutmaSistemi {
        port sogutucuCikis : YakitCikisPortu;
    }

    /* Flow definition */
    flow def YakitAktarimi {
        son kaynak : YakitDeposu;
        son target : Motor;
    }

    part def Arac {
        part yakitDeposu : YakitDeposu;
        part motor : Motor;
        part sogutma : SogutmaSistemi;

        /* Connection usage */
        connection yakitHatti : YakitAktarimi
            connect yakitDeposu.yakitCikis to motor.yakitGiris;

        /* Flow usage with items */
        flow yakitAkis of Yakit from yakitDeposu.yakitCikis to motor.yakitGiris;

        /* Succession flow */
        succession flow sogutucuAkisi of Sogutucu from sogutma.sogutucuCikis to motor.sogutucuPortu;

        /* Interface usage */
        interface yakitArayuzu connect yakitDeposu.yakitCikis to motor.yakitGiris;

        /* Allocation usage */
        allocate motor to yakitDeposu;
    }
}
