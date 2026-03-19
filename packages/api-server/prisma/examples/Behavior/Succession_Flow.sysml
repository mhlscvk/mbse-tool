package SuccessionFlowExample {
  private import ScalarValues::*;

  item def Image;
  item def Picture;

  action def Focus {
    in item scene : Image;
    out item image : Image;
  }

  action def Shoot {
    in item image : Image;
    out item picture : Picture;
  }

  action def TakePicture {
    in item scene : Image;
    out item picture : Picture;

    action focus : Focus;
    action shoot : Shoot;

    succession flow focus.image to shoot.image;

    first start then focus;
    first focus then shoot;
    first shoot then done;
  }

  part def Camera {
    part sensor;
    part processor;
    message of Image from sensor to processor;
  }
}
