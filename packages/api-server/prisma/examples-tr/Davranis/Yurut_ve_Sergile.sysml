package YurutVeSergile {

  action def Hizlan;
  action def Frenle;
  action def Direksiyon;

  state def SurusDurumlari {
    entry;
    then bosta;

    state bosta;
    state hareketHalinde;
    state durdu;

    transition baslat_hareket
      first bosta then hareketHalinde;
    transition durdur
      first hareketHalinde then durdu;
    transition resume
      first durdu then hareketHalinde;
  }

  part def Arac {
    perform action hizlan : Hizlan;
    perform action fren : Frenle;
    perform action steer : Direksiyon;
    exhibit state surusDurumlari : SurusDurumlari;
  }
}
