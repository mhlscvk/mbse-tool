package ActionParameters {
  private import ScalarValues::*;

  item def FuelCmd {
    attribute throttleLevel : Real;
  }

  item def Torque;

  action def GenerateTorque {
    in item fuelCmd : FuelCmd;
    out item engineTorque : Torque;
  }

  action def AmplifyTorque {
    in item inputTorque : Torque;
    out item outputTorque : Torque;
  }

  action def ProvidePower {
    in item fuelCmd : FuelCmd;
    out attribute wheelTorque : Real;

    action generate : GenerateTorque;
    action amplify : AmplifyTorque;

    flow generate.engineTorque to amplify.inputTorque;

    first start then generate;
    first generate then amplify;
    first amplify then done;
  }
}
