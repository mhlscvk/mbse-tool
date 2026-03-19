package Connections {
  private import ScalarValues::*;

  port def FuelPort;
  port def ControlPort;
  port def DrivePwrPort;

  part def Engine {
    port fuelInPort : FuelPort;
    port drivePwrPort : DrivePwrPort;
    port controlPort : ControlPort;
  }

  part def FuelTank {
    port fuelOutPort : FuelPort;
  }

  part def Transmission {
    port clutchPort : DrivePwrPort;
    port shaftPort : DrivePwrPort;
  }

  part def Controller {
    port controlPort : ControlPort;
  }

  interface def FuelInterface {
    port fuelOut : FuelPort;
    port fuelIn : FuelPort;
  }

  part vehicle {
    part fuelTank : FuelTank;
    part engine : Engine;
    part transmission : Transmission;
    part controller : Controller;
    connect fuelTank.fuelOutPort to engine.fuelInPort;
    connect engine.drivePwrPort to transmission.clutchPort;
    connect controller.controlPort to engine.controlPort;
  }
}