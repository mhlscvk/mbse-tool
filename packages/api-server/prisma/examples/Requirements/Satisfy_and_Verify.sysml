package SatisfyAndVerify {
  private import ScalarValues::*;

  part def Vehicle {
    attribute mass : Real;
    attribute topSpeed : Real;
  }

  requirement def MassRequirement {
    doc /* The vehicle mass shall not exceed the specified limit. */
    attribute massLimit : Real;
    attribute massActual : Real;
  }

  requirement def PerformanceRequirement {
    doc /* The vehicle shall meet minimum performance targets. */
    attribute minTopSpeed : Real;
  }

  requirement vehicleSpec {
    doc /* Vehicle specification requirements. */

    requirement massReq : MassRequirement {
      doc /* Total mass shall not exceed 2000 kg. */
    }

    requirement perfReq : PerformanceRequirement {
      doc /* Top speed shall exceed 200 km/h. */
    }
  }

  part vehicle : Vehicle;

  satisfy vehicleSpec by vehicle;

  verification case def MassTest {
    doc /* Verify the vehicle mass requirement. */
  }

  verification case massTest : MassTest {
    action weighVehicle;
    action evaluateResult;
    first start then weighVehicle;
    first weighVehicle then evaluateResult;
    first evaluateResult then done;
  }

  verify vehicleSpec.massReq by massTest;
}
