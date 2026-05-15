package ParcaTanimlari {
  private import ScalarValues::*;
  private import ISQ::*;

  part def Arac {
    attribute kutle : Real;
    attribute kuruKutle : Real;
    attribute yukKutlesi : Real;
    part motor : Motor;
    ref part surucu : Kisi;
  }

  attribute def VehicleStatus {
    attribute vitesAyari : Integer;
    attribute gazPedaliKonumu : Real;
  }

  part def Motor {
    attribute silindirHacmi : Real;
    attribute beygirGucu : Real;
  }

  part def Kisi;
}