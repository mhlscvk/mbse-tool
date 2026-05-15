package GonderKabulEylemleri {
    item def AracBaslangici;
    item def MotorDurumu;

    part def Surucu {
        port komutPortu;
    }

    part def Arac {
        port kontrolPortu;
    }

    action def AraciCalistir {
        /* Surucu sends a start komut to the arac */
        event occurrence suruculHazir;
        event occurrence kapiKapali;

        first kapiKapali then suruculHazir;

        action ac send vs : AracBaslangici to arac.kontrolPortu;
        action baslamayiBekle accept vs : AracBaslangici;

        flow of AracBaslangici from ac.vs to baslamayiBekle.vs;

        action motorCalistir {
            in item vs : AracBaslangici;
            out item es : MotorDurumu;
        }

        action durumBildir send es : MotorDurumu to surucu.komutPortu;
        action durumAl accept es : MotorDurumu;

        message of AracBaslangici from ac to baslamayiBekle;
        message of MotorDurumu from durumBildir to durumAl;
    }

    part surucu : Surucu;
    part arac : Arac;
}
