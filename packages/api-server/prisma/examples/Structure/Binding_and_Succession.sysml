package BindingAndSuccession {

  part def Sensor {
    attribute reading : Real;
  }

  part def Controller {
    attribute command : Real;
  }

  part def System {
    part sensor : Sensor;
    part controller : Controller;
    bind sensor.reading = controller.command;
  }

  action def Step1;
  action def Step2;
  action def Step3;

  action process {
    action step1 : Step1;
    action step2 : Step2;
    action step3 : Step3;
    first start then step1;
    first step1 then step2;
    first step2 then step3;
    first step3 then done;
  }
}
