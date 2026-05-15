package MesajlarVeSekanslar {
    item def BaslatmaIstegi;
    item def Onay;
    item def AtesleSinyali;
    item def DevSayisiOkumasi;
    item def GostergeGuncellemesi;

    part def Surucu {
        port komutPortu;
    }

    part def Arac {
        port kontrolPortu;
        part motor : Motor;
        part gostergePaneli : GostergePaneli;
    }

    part def Motor {
        port motorPortu;
    }

    part def GostergePaneli {
        port ekranPortu;
    }

    part surucu : Surucu;
    part arac : Arac;

    /* Event occurrences as triggers */
    event occurrence anahtarTakildi;
    event occurrence motorCalisiyor;

    action def AracBaslatmaDizisi {
        /* Adim 1: Surucu sends start request to arac */
        action baslatmaGonder send sr : BaslatmaIstegi to arac.kontrolPortu;
        action baslatmaAl accept sr : BaslatmaIstegi;

        /* Adim 2: Arac forwards atesle sinyal to motor */
        action atesleGonder send at : AtesleSinyali to arac.motor.motorPortu;
        action atesleAl accept at : AtesleSinyali;

        /* Adim 3: Motor reports DevSayisi arka to arac */
        action devSayisiGonder send devSayisi : DevSayisiOkumasi to arac.kontrolPortu;
        action devSayisiAl accept devSayisi : DevSayisiOkumasi;

        /* Message sequence — defines the interaction diagram */
        message of BaslatmaIstegi from surucu.komutPortu to arac.kontrolPortu;
        message of AtesleSinyali from arac.kontrolPortu to arac.motor.motorPortu;
        message of DevSayisiOkumasi from arac.motor.motorPortu to arac.kontrolPortu;
        message of GostergeGuncellemesi from arac.kontrolPortu to arac.gostergePaneli.ekranPortu;
        message of Onay from arac.kontrolPortu to surucu.komutPortu;

        /* Zamansal ordering of steps */
        first baslatmaGonder then atesleGonder;
        first atesleGonder then devSayisiGonder;
    }
}
