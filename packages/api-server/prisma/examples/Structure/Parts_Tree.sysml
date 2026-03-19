package PartsTree {
  private import ScalarValues::*;
  private import ISQ::*;

  part def Vehicle;
  part def Engine;
  part def Transmission;
  part def Driveshaft;
  part def FrontAxle;
  part def Axle;
  part def Wheel;
  part def Differential;
  part def StarterMotor;
  part def FuelTank;

  part vehicle : Vehicle {
    part starterMotor : StarterMotor;
    part fuelTank : FuelTank;
    part engine : Engine;
    part transmission : Transmission;
    part driveshaft : Driveshaft;
    part rearAxleAssembly {
      part differential : Differential;
      part rearAxle : Axle;
      part rearWheel1 : Wheel;
      part rearWheel2 : Wheel;
    }
    part frontAxleAssembly {
      part frontAxle : FrontAxle;
      part frontWheels : Wheel;
    }
  }
}