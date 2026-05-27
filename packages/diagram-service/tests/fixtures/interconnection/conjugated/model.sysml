package ConjugatedIv {
  port def FuelPort {
    out item fuel;
  }
  port def CmdPort {
    in item cmd;
  }

  interface def FuelInterface {
    end port supplier : FuelPort;
    end port consumer : ~FuelPort;
  }

  part def Engine {
    port fuelIn : ~FuelPort;
    port cmdIn : CmdPort;
  }
  part def Tank {
    port fuelOut : FuelPort;
  }

  part vehicle {
    part engine : Engine;
    part tank : Tank;
    connect tank.fuelOut to engine.fuelIn;
    flow from tank.fuelOut to engine.fuelIn;
    bind engine.cmdIn = tank.fuelOut;
  }
}
