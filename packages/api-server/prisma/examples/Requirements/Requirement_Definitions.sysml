package RequirementDefinitions {
  private import ScalarValues::*;
  private import ISQ::*;

  requirement def MassRequirement {
    doc /* The actual mass shall be less than the required mass. */
    attribute massRequired : Real;
    attribute massActual : Real;
  }

  requirement def FuelEconomyRequirement {
    doc /* The fuel economy shall meet or exceed the required value. */
    attribute requiredFuelEconomy : Real;
    attribute actualFuelEconomy : Real;
  }

  requirement def PerformanceRequirement {
    doc /* The system shall meet performance targets. */
    attribute targetValue : Real;
    attribute measuredValue : Real;
  }

  constraint def MassConstraint {
    doc /* Mass must not exceed the maximum allowed. */
    attribute maxMass : Real;
    attribute actualMass : Real;
  }
}