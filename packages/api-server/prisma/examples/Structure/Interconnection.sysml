package Interconnection {
  private import ScalarValues::*;

  item def Signal;
  item def Power;

  port def DataPort {
    in item dataIn : Signal;
    out item dataOut : Signal;
  }

  port def PowerPort {
    in item powerIn : Power;
  }

  part def Sensor {
    port dataPort : DataPort;
    attribute reading : Real;
  }

  part def Controller {
    port sensorPort : ~DataPort;
    port actuatorPort : DataPort;
    port powerPort : PowerPort;
  }

  part def Actuator {
    port commandPort : ~DataPort;
    attribute position : Real;
  }

  part def PowerSupply {
    port powerOut : ~PowerPort;
  }

  part controlSystem {
    part sensor : Sensor;
    part controller : Controller;
    part actuator : Actuator;
    part power : PowerSupply;

    connect sensor.dataPort to controller.sensorPort;
    connect controller.actuatorPort to actuator.commandPort;
    connect power.powerOut to controller.powerPort;
  }
}
