package RedefinitionAndSubsetting {

  part def Cylinder;

  part def Engine {
    part cyl : Cylinder[4..6];
    attribute horsepower : Real;
  }

  part def SmallEngine :> Engine {
    part redefines cyl[4];
  }

  part def BigEngine :> Engine {
    part redefines cyl[6];
  }

  part def Vehicle {
    part eng : Engine;
  }

  part def SmallVehicle :> Vehicle {
    part smallEng : SmallEngine redefines eng;
  }

  part def BigVehicle :> Vehicle {
    part bigEng : BigEngine :>> eng;
  }
}
