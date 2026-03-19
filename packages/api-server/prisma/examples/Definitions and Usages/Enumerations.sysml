package Enumerations {
  private import ScalarValues::*;

  enum def FuelKind {
    gas;
    diesel;
    electric;
  }

  enum def IgnitionOnOff {
    on;
    off;
  }

  attribute def ConditionLevel {
    attribute color : String;
  }

  enum def RiskLevel {
    low;
    medium;
    high;
  }

  part def FuelTank {
    attribute fuelKind : FuelKind;
    attribute capacity : Real;
  }
}