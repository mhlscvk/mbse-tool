package VehicleRequirements {
  private import ScalarValues::*;
  private import ISQ::*;

  part def Vehicle {
    attribute mass : Real;
    attribute dryMass : Real;
    attribute cargoMass : Real;
  }

  requirement def MassRequirement {
    doc /* The actual mass shall be less than the required mass. */
    attribute massRequired : Real;
    attribute massActual : Real;
  }

  requirement def FuelEconomyRequirement {
    doc /* The fuel economy shall meet or exceed the required value. */
    attribute requiredFuelEconomy : Real;
  }

  requirement vehicleSpecification {
    doc /* Top-level vehicle specification requirements. */

    requirement vehicleMassRequirement : MassRequirement {
      doc /* The total mass of the vehicle shall be less than or equal to 2000 kg. */
      attribute massRequired : Real;
      attribute massActual : Real;
    }

    requirement cityFuelEconomy : FuelEconomyRequirement {
      doc /* City fuel economy shall be at least 10 km per litre. */
      attribute requiredFuelEconomy : Real;
    }

    requirement highwayFuelEconomy : FuelEconomyRequirement {
      doc /* Highway fuel economy shall be at least 12.75 km per litre. */
      attribute requiredFuelEconomy : Real;
    }
  }

  part vehicle : Vehicle;
  satisfy vehicleSpecification by vehicle;
}