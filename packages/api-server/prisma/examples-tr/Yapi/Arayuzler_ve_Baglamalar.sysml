package ArayuzlerVeBaglamalar {
    item def ElektrikGucu;
    item def VeriSinyali;

    port def GucCikisPortu {
        out item guc : ElektrikGucu;
    }

    port def GucGirisPortu {
        in item guc : ElektrikGucu;
    }

    port def VeriPortu {
        inout item veri : VeriSinyali;
    }

    /* Interface definition — specifies a connection contract */
    interface def GucArayuzu {
        son kaynak : GucCikisPortu;
        son target : GucGirisPortu;
    }

    interface def VeriYolu {
        son ucA : VeriPortu;
        son ucB : VeriPortu;
    }

    part def Batarya {
        port gucCikis : GucCikisPortu;
    }

    part def Motor {
        port gucGiris : GucGirisPortu;
        port iletisimPortu : VeriPortu;
    }

    part def Denetleyici {
        /* Conjugated port — reverses the flow yon */
        port gucKaynagi : ~GucCikisPortu;
        port iletisimPortu : VeriPortu;
        attribute maksimumAkim : Real;
    }

    part def ElektrikliCekisHatti {
        part batarya : Batarya;
        part motor : Motor;
        part denetleyici : Denetleyici;

        /* Interface usage — typed connection between ports */
        interface gucBaglantisi : GucArayuzu
            connect batarya.gucCikis to motor.gucGiris;

        interface veriBaglantisi : VeriYolu
            connect denetleyici.iletisimPortu to motor.iletisimPortu;

        /* Bind — equates two features so they share the same value */
        bind batarya.gucCikis.guc = motor.gucGiris.guc;
        bind denetleyici.iletisimPortu.veri = motor.iletisimPortu.veri;
    }
}
