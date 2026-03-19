package ItemsAndPorts {
  private import ScalarValues::*;
  private import ISQ::*;

  item def Fuel {
    attribute fuelMass : Real;
  }

  item def FuelCmd {
    attribute throttleLevel : Real;
  }

  item def IgnitionCmd {
    attribute ignitionOnOff : String;
  }

  port def FuelPort {
    out item fuel : Fuel;
  }

  port def FuelCmdPort {
    in item fuelCmd : FuelCmd;
  }

  port def IgnitionCmdPort {
    in item ignitionCmd : IgnitionCmd;
  }

  port def DrivePwrPort {
    out item engineTorque : Real;
  }

  interface def FuelInterface {
    port fuelOutPort : FuelPort;
    port fuelInPort : FuelPort;
  }
}