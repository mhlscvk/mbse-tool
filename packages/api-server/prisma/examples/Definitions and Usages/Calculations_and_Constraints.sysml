package CalculationsAndConstraints {
    attribute def Mass;
    attribute def FuelConsumption;
    attribute def Distance;

    /* Calculation definitions for analysis */
    calc def FuelEconomyCalc {
        in attribute distance : Distance;
        in attribute fuelUsed : FuelConsumption;
        return attribute economy : FuelConsumption;
    }

    calc def TotalMassCalc {
        in attribute dryMass : Mass;
        in attribute cargoMass : Mass;
        return attribute totalMass : Mass;
    }

    /* Calculation usages */
    calc fuelEconomy : FuelEconomyCalc;
    calc totalMass : TotalMassCalc;

    /* Constraint definition */
    constraint def MassLimit {
        attribute maxMass : Mass;
        attribute actualMass : Mass;
    }

    /* Constraint usage */
    constraint vehicleMassLimit : MassLimit;

    part def Vehicle {
        attribute mass : Mass;
        attribute cargo : Mass;

        /* Assert constraint */
        assert constraint massOk : MassLimit;
    }
}
