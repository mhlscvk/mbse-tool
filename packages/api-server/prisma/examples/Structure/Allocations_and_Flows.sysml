package AllocationsAndFlows {
  private import ScalarValues::*;

  part def Sensor {
    attribute reading : Real;
  }

  part def Controller {
    attribute command : Real;
  }

  part def Actuator {
    attribute position : Real;
  }

  item def SensorData {
    attribute value : Real;
  }

  item def ControlSignal {
    attribute level : Real;
  }

  part controlSystem {
    part sensor : Sensor;
    part controller : Controller;
    part actuator : Actuator;
    flow from sensor.reading to controller.command;
    flow from controller.command to actuator.position;
    allocate sensor.reading to controller.command;
  }
}