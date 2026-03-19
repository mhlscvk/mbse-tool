package PortsAndFlows {
  private import ScalarValues::*;

  item def Fuel;
  item def Exhaust;

  port def FuelPort {
    out item fuelOut : Fuel;
  }

  port def EnginePort {
    in item fuelIn : Fuel;
    out item exhaustOut : Exhaust;
  }

  part def FuelTank {
    port fuelOutPort : FuelPort;
  }

  part def Engine {
    port enginePort : EnginePort;
    port exhaustPort : ~EnginePort;
  }

  part def Vehicle {
    part fuelTank : FuelTank;
    part engine : Engine;
    flow fuelTank.fuelOutPort to engine.enginePort;
  }
}
