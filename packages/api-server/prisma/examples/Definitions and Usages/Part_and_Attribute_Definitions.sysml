package PartDefinitions {
  private import ScalarValues::*;
  private import ISQ::*;

  part def Vehicle {
    attribute mass : Real;
    attribute dryMass : Real;
    attribute cargoMass : Real;
    part eng : Engine;
    ref part driver : Person;
  }

  attribute def VehicleStatus {
    attribute gearSetting : Integer;
    attribute acceleratorPosition : Real;
  }

  part def Engine {
    attribute displacement : Real;
    attribute horsepower : Real;
  }

  part def Person;
}