package Specialization {
  private import ScalarValues::*;

  part def Axle {
    attribute mass : Real;
  }

  part def FrontAxle :> Axle {
    attribute steeringAngle : Real;
  }

  part def RearAxle :> Axle {
    attribute differentialRatio : Real;
  }

  part def Wheel {
    attribute diameter : Real;
    attribute pressure : Real;
  }

  part def Vehicle {
    part frontAxle : FrontAxle;
    part rearAxle : RearAxle;
    part frontWheels : Wheel;
    part rearWheels : Wheel;
  }
}