package VehicleStates {
  private import ScalarValues::*;

  action def PerformSelfTest;
  action def ProvidePower;
  action def ApplyParkingBrake;
  action def SenseTemperature;

  state def VehicleOperatingStates {
    entry;
    then off;

    state off;
    state starting;
    state on {
      entry action selfTest : PerformSelfTest;
      do action power : ProvidePower;
      exit action brake : ApplyParkingBrake;
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
    state maintenance;
    state degraded;

    transition normal_maintenance
      first normal then maintenance;
    transition normal_degraded
      first normal then degraded;
    transition maintenance_normal
      first maintenance then normal;
    transition degraded_normal
      first degraded then normal;
  }

  state def VehicleStates parallel {
    state operatingStates : VehicleOperatingStates;
    state healthStates : VehicleHealthStates;
  }

  part def Vehicle {
    perform action selfTest : PerformSelfTest;
    perform action providePower : ProvidePower;
    exhibit state vehicleStates : VehicleStates;
  }
}