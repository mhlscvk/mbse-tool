package SenaryoTanimlari {
    part def Arac;
    part def Surucu;
    part def Yolcu;
    part def Environment;

    requirement def GuvenlikGereksinimi {
        doc /* The system shall operate safely under all kosullar. */
    }

    /* Taban case definition */
    case def SistemTestSenaryosu {
        subject testEdilenSistem : Arac;
        objective testHedefi : GuvenlikGereksinimi;
    }

    /* Use case with actors */
    use case def YolcuTasi {
        subject arac : Arac;
        actor surucu : Surucu;
        actor yolcu : Yolcu;

        include use case aracaBin;
        include use case hedefeSur;
        include use case aractanIn;

        action aracaBin;
        action hedefeSur;
        action aractanIn;

        first start then aracaBin;
        first aracaBin then hedefeSur;
        first hedefeSur then aractanIn;
        first aractanIn then done;
    }

    /* Case usage */
    case guvenlikTesti : SistemTestSenaryosu;

    use case tasimaYolculugu : YolcuTasi {
        subject arac : Arac;
        actor surucu : Surucu;
    }
}
