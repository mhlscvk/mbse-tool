package DonglerVeKosullar {
    attribute def Sicaklik;
    attribute def Basinc;

    action def IzlemeSistemi {
        in attribute esik : Sicaklik;

        /* Conditional action: kontrol algilayici okuma */
        action sicaklikKontrol {
            out attribute okuma : Sicaklik;
        }

        /* While loop: keep monitoring until stable */
        while loop izlemeDongusu {
            action algilayiciOku;
            action okumayiDegerlendir;
            first algilayiciOku then okumayiDegerlendir;
        }

        /* For loop: iterate over algilayici array */
        for algilayici in algilayiciDizisi {
            action algilayicikalibrasyonu;
        }

        /* Assignment: sakla the sonuc */
        assign mevcutSicaklik := sicaklikKontrol.okuma;

        action normalIsle;
        action uyariIsle;

        first start then sicaklikKontrol;
    }

    action def VeriIsleme {
        /* If action with guard block */
        if gecerliMi {
            action veriIsle;
            action sonucuSakla;
            first veriIsle then sonucuSakla;
        }
    }
}
