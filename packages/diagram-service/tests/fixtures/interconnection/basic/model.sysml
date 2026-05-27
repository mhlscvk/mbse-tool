package BasicIv {
  part def Sensor {
    port out : DataPort;
  }
  part def Controller {
    port in : DataPort;
  }
  port def DataPort {
    out item reading;
  }

  part system {
    part sensor : Sensor;
    part controller : Controller;
    connect sensor.out to controller.in;
  }
}
