package EgerOHalde {

  action def KosulKontrolu;
  action def NormalIsle;
  action def AcilDurumIsle;
  action def SonucKaydi;

  attribute def Durum {
    attribute normalMi : Boolean;
    attribute acilMi : Boolean;
  }

  action olayIsle {
    action kontrol : KosulKontrolu;
    action normalIsle : NormalIsle;
    action acilDurumIsle : AcilDurumIsle;
    action gunluk : SonucKaydi;

    first start then kontrol;
    first kontrol then karar1;

    decide karar1;
    if normalMi then normalIsle;
    if acilMi then acilDurumIsle;

    first normalIsle then birlesim1;
    first acilDurumIsle then birlesim1;
    merge birlesim1;
    first birlesim1 then gunluk;
    first gunluk then done;
  }
}
