package SimpleVehicleModel {
  private import ScalarValues::*;
  private import ISQ::*;

  package Definitions {
    part def Vehicle {
      attribute mass : Real;
      attribute velocity : Real;
      attribute position : Real;
    }

    part def Engine {
      attribute horsepower : Real;
      attribute displacement : Real;
    }

    part def Transmission;
    part def Driveshaft;
    part def FuelTank;
    part def Wheel;
    part def Axle;
    part def FrontAxle :> Axle;
    part def StarterMotor;
    part def Differential;

    enum def FuelKind {
      gas;
      diesel;
    }

    item def Fuel {
      attribute fuelMass : Real;
    }

    item def FuelCmd {
      attribute throttleLevel : Real;
    }

    port def FuelPort;
    port def ControlPort;
    port def DrivePwrPort;
    port def IgnitionCmdPort;

    action def ProvidePower {
      in item fuelCmd : FuelCmd;
      out attribute wheelTorque : Real;
    }

    action def PerformSelfTest;
    action def ApplyParkingBrake;
    action def SenseTemperature;

    requirement def MassRequirement {
      doc /* The actual mass shall be less than the required mass. */
      attribute massRequired : Real;
      attribute massActual : Real;
    }
  }

  package VehicleConfiguration {
    part vehicle : Definitions::Vehicle {
      part starterMotor : Definitions::StarterMotor;
      part fuelTank : Definitions::FuelTank;
      part engine : Definitions::Engine;
      part transmission : Definitions::Transmission;
      part driveshaft : Definitions::Driveshaft;
      part rearAxleAssembly {
        part differential : Definitions::Differential;
        part rearAxle : Definitions::Axle;
        part rearWheel1 : Definitions::Wheel;
        part rearWheel2 : Definitions::Wheel;
      }
      part frontAxleAssembly {
        part frontAxle : Definitions::FrontAxle;
        part frontWheels : Definitions::Wheel;
      }
    }
  }

  package ActionTree {
    action def GenerateTorque;
    action def AmplifyTorque;
    action def TransferTorque;
    action def DistributeTorque;

    action providePower : Definitions::ProvidePower {
      action generateTorque : GenerateTorque;
      action amplifyTorque : AmplifyTorque;
      action transferTorque : TransferTorque;
      action distributeTorque : DistributeTorque;
      first start then generateTorque;
      first generateTorque then amplifyTorque;
      first amplifyTorque then transferTorque;
      first transferTorque then distributeTorque;
      first distributeTorque then done;
    }
  }

  package States {
    state def VehicleOperatingStates {
      entry;
      then off;

      state off;
      state starting;
      state on {
        entry action selfTest : Definitions::PerformSelfTest;
        do action power : Definitions::ProvidePower;
        exit action brake : Definitions::ApplyParkingBrake;
      }

      transition off_starting
        first off then starting;
      transition starting_on
        first starting then on;
      transition on_off
        first on then off;
    }

    state def VehicleHealthStates {
      entry;
      then normal;

      state normal;
      state degraded;

      transition normal_degraded
        first normal then degraded;
      transition degraded_normal
        first degraded then normal;
    }
  }

  package Requirements {
    requirement vehicleSpec {
      doc /* Top-level vehicle specification. */

      requirement vehicleMassReq : Definitions::MassRequirement {
        doc /* Vehicle mass shall not exceed 2000 kg. */
        attribute massRequired : Real;
        attribute massActual : Real;
      }
    }

    satisfy vehicleSpec by VehicleConfiguration::vehicle;
  }
}