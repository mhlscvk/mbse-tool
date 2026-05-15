package OlaylarVeZamansal {
    /* Occurrence definitions model things that happen over time */
    occurrence def Accident;
    occurrence def BakimKontrolu;

    occurrence roadIncident : Accident;
    occurrence scheduledService : BakimKontrolu;

    /* Event occurrences as significant instants */
    event occurrence atesleAc;
    event occurrence atesleKapat;
    event occurrence carpismaAlgilandi;

    part def Arac {
        part motor : Motor;
        part frenler : FrenSistemi;
    }

    part def Motor;
    part def FrenSistemi;

    /* Individual definition — a specific arac identity */
    individual def Arac_1 :> Arac;

    /* Individual usage with snapshots and timeslices */
    individual benimAracim : Arac_1 {
        /* AnliklarPaketi capture state at a nokta in time */
        snapshot t0 {
            /* Arac at rest before seyahat */
        }

        snapshot t1 {
            /* Arac at rest after seyahat */
        }

        /* Timeslice captures a sure of time */
        timeslice seyahat {
            /* Arac is in hareket during this period */
        }

        /* Zamansal ordering */
        first t0 then seyahat;
        first seyahat then t1;
    }

    /* Mesajlar between parcalar during an occurrence */
    item def FrenKomutu;
    item def DurumRaporu;

    action def AcilDurus {
        in item carpisma : Accident;

        message of FrenKomutu from benimAracim.motor to benimAracim.frenler;
        message of DurumRaporu from benimAracim.frenler to benimAracim.motor;
    }
}
