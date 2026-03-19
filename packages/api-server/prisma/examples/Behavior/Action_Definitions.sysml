package ActionDefinitions {
  private import ScalarValues::*;

  item def FuelCmd {
    attribute throttleLevel : Real;
  }

  item def Torque;

  action def ProvidePower {
    in item fuelCmd : FuelCmd;
    out attribute wheelTorque : Real;
  }

  action def GenerateTorque {
    in item fuelCmd : FuelCmd;
    out item engineTorque : Torque;
  }

  action def AmplifyTorque {
    in item engineTorque : Torque;
    out item transmissionTorque : Torque;
  }

  action def TransferTorque {
    in item transmissionTorque : Torque;
    out item driveshaftTorque : Torque;
  }

  action def DistributeTorque {
    in item driveshaftTorque : Torque;
    out attribute wheelTorque : Real;
  }
}