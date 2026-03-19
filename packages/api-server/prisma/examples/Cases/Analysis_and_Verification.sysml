package AnalysisAndVerification {
  private import ScalarValues::*;
  private import ISQ::*;

  part def Vehicle {
    attribute mass : Real;
  }

  requirement def MassRequirement {
    attribute massRequired : Real;
    attribute massActual : Real;
  }

  requirement vehicleMassReq : MassRequirement {
    doc /* Vehicle mass shall not exceed 2000 kg. */
    attribute massRequired : Real;
    attribute massActual : Real;
  }

  part vehicle : Vehicle;

  analysis case def FuelEconomyAnalysis {
    doc /* Estimate the fuel economy of the vehicle. */
  }

  analysis case fuelEconomyAnalysis : FuelEconomyAnalysis {
    doc /* Compute fuel economy for the given scenario. */
    in attribute scenario : String;
  }

  verification case def MassTest {
    doc /* Verify the vehicle mass meets the requirement. */
  }

  verification case massTest : MassTest {
    doc /* Weigh the vehicle and evaluate pass or fail. */
    action weighVehicle;
    action evaluatePassFail;
    first start then weighVehicle;
    first weighVehicle then evaluatePassFail;
    first evaluatePassFail then done;
  }

  satisfy vehicleMassReq by vehicle;
}