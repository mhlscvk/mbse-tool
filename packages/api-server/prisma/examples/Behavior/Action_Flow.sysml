package ActionFlow {
  private import ScalarValues::*;

  item def FuelCmd;
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

  action providePower : ProvidePower {
    action generateTorque : GenerateTorque;
    action amplifyTorque : AmplifyTorque;
    action transferTorque : TransferTorque;
    action distributeTorque : DistributeTorque;
    flow generateTorque.engineTorque to amplifyTorque.engineTorque;
    flow amplifyTorque.transmissionTorque to transferTorque.transmissionTorque;
    flow transferTorque.driveshaftTorque to distributeTorque.driveshaftTorque;
  }
}